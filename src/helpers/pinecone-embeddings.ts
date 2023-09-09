import 'dotenv/config'
import supabase from "../supabase.js";
import {RecursiveCharacterTextSplitter} from "langchain/text_splitter";
import {PineconeClient} from "@pinecone-database/pinecone";
import {pipeline} from "@xenova/transformers";
// Helper function to chunk an array into smaller arrays
function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        chunks.push(arr.slice(i, i + chunkSize));
    }
    return chunks;
}
console.log("Fetching profiles...")

const PINECONE_INDEX = "findcaster"

// const MODEL_NAME = 'embed-english-v2.0';
const MODEL_NAME = 'feature-extraction';

export interface ProfileWithCast {
    profile_id: number;
    profile_username: string;
    profile_bio: string;
    profile_display_name: string;
    all_casts_text: string;
}
export const fetchProfilesWithCasts = async (page: number = 1, limit: number = 100): Promise<ProfileWithCast[]> => {
    const {data, error} = await supabase.rpc('get_latest_casts', {limit_count: 25}).range(page, page + limit)
    if (error) throw error
    return data as ProfileWithCast[]
}

export const syncOnPinecone = async (profile: ProfileWithCast) => {
    console.log(`Syncing ${profile.profile_id}...`)
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
        [profile.all_casts_text!, profile.profile_bio!, profile.profile_username!, profile.profile_display_name!].filter(Boolean),
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
                id: `${profile.profile_id}_${index}`,
                values: embeddings[index],
                metadata: {
                    ...chunk.metadata,
                    loc: JSON.stringify(chunk.metadata.loc),
                    pageContent: chunk.pageContent,
                    profileId: profile.profile_id,
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
}

const fetchAllProfiles = async () => {
    const allProfiles = [];
    let page = 0;
    let profiles;

    do {
        console.log(`Fetching page ${page}...`);
        profiles = await fetchProfilesWithCasts(page * 1000, 1000); // Adjust parameters as needed
        if (profiles.length > 0) {
            allProfiles.push(...profiles);
            page++;
        }
    } while (profiles.length > 0);

    return allProfiles;
};


const profiles = await fetchAllProfiles()

const profileChunks = chunkArray(profiles, 10)

for (const profileChunk of profileChunks) {
    await Promise.all(profileChunk.map(syncOnPinecone))
}

console.log(profiles)
