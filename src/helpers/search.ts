import { pipeline } from '@xenova/transformers'
import 'dotenv/config'

import supabase from '../supabase.js'

const searchArgv = process.argv.findIndex((arg) => arg === '--text')
if (!searchArgv) {
  throw new Error('Missing --text argument')
}
const text = process.argv[searchArgv + 1]

const thresholdArgv = process.argv.findIndex((arg) => arg === '--threshold')
if (!thresholdArgv) {
  throw new Error('Missing --threshold argument')
}
const threshold = Number(process.argv[thresholdArgv + 1])

const countArgv = process.argv.findIndex((arg) => arg === '--count')
if (!countArgv) {
  throw new Error('Missing --count argument')
}
const count = Number(process.argv[countArgv + 1])

const generateEmbedding = await pipeline(
  'feature-extraction',
  'Supabase/gte-small'
)

const output = await generateEmbedding(text, {
  pooling: 'mean',
  normalize: true,
})

const embedding = Array.from(output.data)

const { data: casts } = await supabase.rpc('match_casts', {
  query_embedding: embedding,
  match_threshold: threshold,
  match_count: count,
})

if (!casts) {
  console.log('No casts found')
  process.exit(0)
}

const { data: dbCasts } = await supabase
  .from('casts')
  .select('*')
  .in(
    'hash',
    casts?.map((cast) => cast.cast_hash)
  )

console.log(dbCasts)
