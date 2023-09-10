import 'dotenv/config'

import {generateEmbeddings} from '../functions/generate-embeddings.js'
import {cleanCasts} from '../functions/index-casts.js'
import {Cast} from "../types";
import supabase from "../supabase.js";

const batchSize = 1000; // Set the batch size to 1000 records
let startingOffset = 0;

async function processCasts() {
    while (true) {
        const {data: casts, error} = await supabase
            .from('casts')
            .select('*')
            .range(startingOffset, startingOffset + batchSize - 1).order("published_at", {ascending: false}); // Fetch the next batch of records

        if (error) {
            console.error('Error fetching data:', error);
            return;
        }

        if (casts && casts.length > 0) {
            const cleanedCasts = cleanCasts(casts as Cast[]);

            await generateEmbeddings(cleanedCasts);

            console.log(`Processed ${cleanedCasts.length} records. Total processed: ${startingOffset + cleanedCasts.length}`);

            startingOffset += batchSize; // Update the offset for the next batch
        } else {
            console.log('Finished generating embeddings!');
            break; // Exit the loop when there are no more records
        }
    }
}

console.log('Generating embeddings..');
await processCasts();



