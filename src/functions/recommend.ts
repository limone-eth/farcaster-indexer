import supabase from '../supabase.js'
import {Cast} from '../types'
import {generateEmbeddings} from './generate-embeddings.js'

export const getCastsRecommendations = async (casts: Cast[]) => {
    let {data: castEmbeddings} = await supabase
        .from('casts_embeddings')
        .select('*')
        .in(
            'cast_hash',
            casts.map((cast) => cast.hash)
        )

  if (!castEmbeddings) {
    throw new Error('No embeddings found for the user')
  }

  if (castEmbeddings.length !== casts.length) {
    // Mismatch in the length, some embeddings are missing. Generate them on the fly.
    // TODO: should only regenerate the missing embeddings
      castEmbeddings = await generateEmbeddings(casts, false)
      console.log(`Generated ${castEmbeddings.length} embeddings`)
  }

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

  const recommendationTypeArgv = process.argv.findIndex(
    (arg) => arg === '--recommendation-type'
  )
  if (!recommendationTypeArgv) {
    throw new Error('Missing --recommendation-type argument')
  }
  const recommendationType = process.argv[recommendationTypeArgv + 1]
  if (!['users', 'casts'].includes(recommendationType)) {
    throw new Error(
      'Invalid recommendation type: must be either "users" or "casts"'
    )
  }

  const recommendations = await Promise.all(
    castEmbeddings.map(async ({ embedding }) => {
      // Find similar casts to what the user has posted
      const { data: casts } = await supabase.rpc('match_casts', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: count,
      })

      if (!casts) {
        return null
      }

      const { data: dbCasts } = await supabase
        .from('casts')
        .select('*')
        .in(
          'hash',
          casts?.map((cast) => cast.cast_hash)
        )

      if (recommendationType === 'casts') {
        return dbCasts?.filter((cast) => cast.text.length > 15)
      } else {
        return dbCasts?.filter((cast) => cast.text.length > 15).map((cast) => {
          return {
            fid: cast.author_fid,
            username: cast.author_username,
            displayName: cast.author_display_name,
              castHash: cast.hash,
          }
        })
      }
    })
  )
  const flattenedRecommendations = recommendations.filter((el) => el).flat()

  // Remove duplicates based on object property
  const uniqueRecommendations = flattenedRecommendations.filter(
    (element, index, self) => {
        return (
            self.findIndex((indexElement) => {
                if (recommendationType === 'casts') {
                    return indexElement.hash === element.hash
                }
                return indexElement.fid === element.fid
            }) === index
        )
    }
  )
    return uniqueRecommendations;
}
