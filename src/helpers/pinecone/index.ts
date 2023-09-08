import {FlattenedCast, FlattenedProfile, FlattenedProfileWithCasts} from "../../types";
import {RecursiveCharacterTextSplitter} from "langchain/text_splitter";
import {PineconeClient} from "@pinecone-database/pinecone";
import {pipeline} from "@xenova/transformers";

const PINECONE_INDEX = "findcaster"

// const MODEL_NAME = 'embed-english-v2.0';
const MODEL_NAME = 'feature-extraction';

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
    const generateEmbedding = await pipeline(
        MODEL_NAME,"Xenova/paraphrase-albert-small-v2"
    )
    const embeddings: number[][] = await Promise.all(
        docs.map(async (doc) => {
            const output = await generateEmbedding(doc.pageContent, {
                pooling: 'mean',
                normalize: true,
            })

            return Array.from(output.data)
        })
    )

    // Upsert the generated vectors
    const batch = [];
    for (let index = 0; index < docs.length; index++) {
        const chunk = docs[index];
        if (embeddings[index]?.length === 768 ) {
            const vector = {
                id: `${profile.id}_${index}`,
                values: embeddings[index],
                metadata: {
                    ...chunk.metadata,
                    loc: JSON.stringify(chunk.metadata.loc),
                    pageContent: chunk.pageContent,
                    profileId: profile.id,
                },
            };
            batch.push(vector);
            try {
                const batchChunks = chunkArray(batch, 90);
                for (const batchChunk of batchChunks) {
                    await pineconeIndex.upsert({
                        upsertRequest: {
                            vectors: batchChunk,
                        },
                    });
                }
            } catch (e) {
                console.error("Error upserting vectors: ", {e});
            }
        }
    }
};