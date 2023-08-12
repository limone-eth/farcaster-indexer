import 'dotenv/config'

import { getCurrentUser } from '../functions/get-current-user.js'
import { getUserCastLikes } from '../functions/get-user-cast-likes.js'
import { getCastsRecommendations } from '../functions/recommend.js'
import supabase from '../supabase.js'

const currentUser = await getCurrentUser()

if (!currentUser) {
  throw new Error('Error while fetching current user')
}

const likes = await getUserCastLikes(currentUser.fid)

if (!likes) {
  throw new Error('No liked casts found')
}

const hashes = likes.map((like) => like.castHash)
const { data: casts } = await supabase
  .from('casts')
  .select('*')
  .in('hash', hashes)

if (!casts) {
  throw new Error('No casts found')
}

await getCastsRecommendations(casts)
