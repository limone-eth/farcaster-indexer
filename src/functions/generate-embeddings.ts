import { pipeline } from '@xenova/transformers'

import supabase from '../supabase.js'
import { Cast } from '../types/index.js'
import { breakIntoChunks } from '../utils.js'

export const generateEmbeddings = async (
  casts: Cast[],
  upsert: boolean = true
) => {
  const startTime = Date.now()
  const generateEmbedding = await pipeline(
    'feature-extraction',
    'Supabase/gte-small'
  )

  const castsEmbeddings = await Promise.all(
    casts.map(async (cast) => {
      const output = await generateEmbedding(cast.text, {
        pooling: 'mean',
        normalize: true,
      })

      const embedding = Array.from(output.data)

      return {
        cast_hash: cast.hash,
        embedding,
      }
    })
  )

  if (upsert) {
    const chunks = breakIntoChunks(castsEmbeddings, 1000)

    // Upsert each chunk into the Supabase table
    for (const chunk of chunks) {
      const { error } = await supabase.from('casts_embeddings').upsert(chunk, {
        onConflict: 'cast_hash',
      })

      if (error) {
        throw error
      }
    }

    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000

    if (duration > 60) {
      // If it takes more than 60 seconds, log the duration so we can optimize
      console.log(
        `Created ${castsEmbeddings.length} embeddings in ${duration} seconds`
      )
    }
  }

  return castsEmbeddings
}
