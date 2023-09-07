import {FlattenedCast, FlattenedProfile, FlattenedProfileWithCasts} from "../../types";
import {RecursiveCharacterTextSplitter} from "langchain/text_splitter";
import {PineconeClient} from "@pinecone-database/pinecone";
import {CohereEmbeddings} from "langchain/embeddings";

const PINECONE_INDEX = "findcaster"

const MODEL_NAME = 'embed-english-v2.0';

export const syncProfilesOnPinecone = async (profiles: FlattenedProfile[], casts: FlattenedCast[], chunkSize = 10) => {
    const chunks = chunkArray(profiles, chunkSize);
    let index = 0;
    for (const chunk of chunks) {
        console.log(`Syncing ${profiles.length} profiles in ${chunks.length} chunks...[${index++} / ${chunks.length}]`, );
        await Promise.all(chunk.map((profile) => syncProfileToPinecone({
            ...profile,
            casts: casts.filter(c => c.author_fid === profile.id)
        }).catch(e => console.error(e))));
    }
    console.log('done');
    return;
};

// Helper function to chunk an array into smaller arrays
function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        chunks.push(arr.slice(i, i + chunkSize));
    }
    return chunks;
}

export const syncProfileToPinecone = async (profile: FlattenedProfileWithCasts) => {
    const {casts} = profile;
    const castArray: string[] = casts?.map((cast) => cast.text);
    if (!profile.bio && (!castArray || castArray.length === 0)) {
        return;
    }

    // Get Pinecone index
    const pinecone = new PineconeClient();
    await pinecone.init({
        environment: 'gcp-starter',
        apiKey: process.env.PINECONE_KEY!,
    });

    // Split text into docs
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 0,
    });

    const docs = await textSplitter.createDocuments(
        [...castArray!, profile.bio!, profile.username!].filter(Boolean),
        []
    );

    const pineconeIndex = pinecone.Index(PINECONE_INDEX);

    const embeddings = new CohereEmbeddings({
        modelName: MODEL_NAME,
        apiKey: process.env.COHERE_API_KEY, // In Node.js defaults to process.env.COHERE_API_KEY
        batchSize: 48, // Default value if omitted is 48. Max value is 96
    });
    const embeddingArrays = (await embeddings.embedDocuments(docs.map((doc) => doc.pageContent))).filter(Boolean);

    // Upsert the generated vectors
    const batch = [];
    for (let index = 0; index < docs.length; index++) {
        const chunk = docs[index];
        if (embeddingArrays[index]?.length === 4096 ) {
            const vector = {
                id: `${profile.id}_${index}`,
                values: embeddingArrays[index],
                metadata: {
                    ...chunk.metadata,
                    loc: JSON.stringify(chunk.metadata.loc),
                    pageContent: chunk.pageContent,
                    profileId: profile.id,
                },
            };
            batch.push(vector);
            try {
                await pineconeIndex.upsert({
                    upsertRequest: {
                        vectors: batch,
                    },
                });
            } catch (e) {
                console.error("Error upserting vectors: ", {e, data: embeddingArrays});
            }
        }
    }
};