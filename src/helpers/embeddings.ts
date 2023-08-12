import 'dotenv/config'

import { generateEmbeddings } from '../functions/generate-embeddings.js'
import { cleanCasts, getAllCasts } from '../functions/index-casts.js'

console.log('Generating embeddings..')
const casts = await getAllCasts()
const cleanedCasts = cleanCasts(casts)

await generateEmbeddings(cleanedCasts)
console.log('Finished generating embeddings!')
