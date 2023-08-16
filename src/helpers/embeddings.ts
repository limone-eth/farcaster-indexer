import 'dotenv/config'

import { generateEmbeddings } from '../functions/generate-embeddings.js'
import { cleanCasts } from '../functions/index-casts.js'
import {Cast} from "../types";
import supabase from "../supabase";

console.log('Generating embeddings..')
const casts = await supabase.from('cast').select('*')
const cleanedCasts = cleanCasts(casts.data as Cast[])

await generateEmbeddings(cleanedCasts)
console.log('Finished generating embeddings!')
