import 'dotenv/config'

import { getCurrentUser } from '../functions/get-current-user.js'
import { getUserCasts } from '../functions/get-user-casts.js'
import { getCastsRecommendations } from '../functions/recommend.js'

const currentUser = await getCurrentUser()

if (!currentUser) {
  throw new Error('Error while fetching current user')
}

const casts = await getUserCasts(currentUser.fid)

if (!casts) {
  throw new Error('No casts found by the user')
}

const userCasts = casts?.filter((cast) => cast.author.fid === currentUser.fid)

// Get last 10 user casts
const slicedUserCasts = userCasts.slice(0, 10)

await getCastsRecommendations(slicedUserCasts)
