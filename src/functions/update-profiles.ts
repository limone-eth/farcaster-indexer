import got from 'got'

import { MERKLE_REQUEST_OPTIONS } from '../merkle.js'
import supabase from '../supabase.js'
import { FlattenedProfile, MerkleResponse, Profile } from '../types/index.js'
import { breakIntoChunks } from '../utils.js'

/**
 * Reformat and upsert all profiles into the database
 */
export async function updateAllProfiles(getOnlyNewOnes = false) {
  const startTime = Date.now()
  const allProfiles = await getAllProfiles(getOnlyNewOnes)

  const formattedProfiles: FlattenedProfile[] = allProfiles.map((p) => {
    return {
      id: p.fid,
      username: p.username || null,
      display_name: p.displayName || null,
      avatar_url: p.pfp?.url || null,
      avatar_verified: p.pfp?.verified || false,
      followers: p.followerCount || null,
      following: p.followingCount || null,
      bio: p.profile?.bio?.text || null,
      referrer: p?.referrerUsername || null,
      updated_at: new Date(),
    }
  })

  // Upsert profiles in chunks to avoid locking the table
  const chunks = breakIntoChunks(formattedProfiles, 500)
  for (const chunk of chunks) {
    const { error } = await supabase
      .from('profile')
      .upsert(chunk, { onConflict: 'id' })

    if (error) {
      throw error
    }
  }

  const endTime = Date.now()
  const duration = (endTime - startTime) / 1000

  if (duration > 60) {
    // If it takes more than 60 seconds, log the duration so we can optimize
    console.log(`Updated ${allProfiles.length} profiles in ${duration} seconds`)
  }

  return formattedProfiles;
}

/**
 * Get all profiles from the Merkle API
 * @returns An array of all Farcaster profiles
 */
export async function getAllProfiles(getOnlyNewOnes = false): Promise<Profile[]> {
  const allProfiles: Profile[] = new Array()
  let endpoint = buildProfileEndpoint()

  while (true) {
    const _response = await got(endpoint, MERKLE_REQUEST_OPTIONS).json()

    const response = _response as MerkleResponse
    const profiles = response.result.users

    if (!profiles) throw new Error('No profiles found')

    if (getOnlyNewOnes) {
      const existingProfile = await supabase.from("profile").select("id").in("id", profiles.map(p => p.fid)).limit(1)
      // If there are existing profiles, stop
      // @ts-ignore
      if (existingProfile && existingProfile.data.length > 0) {
        break;
      }
    }

    for (const profile of profiles) {
      allProfiles.push(profile)
    }

    // If there are more profiles, get the next page
    const cursor = response.next?.cursor
    if (cursor) {
      endpoint = buildProfileEndpoint(cursor)
    } else {
      break
    }
  }

  // If there are missing ids (warpcast filtering), insert an empty profile
  const maxId = allProfiles[0]?.fid
  for (let i = 1; i <= maxId; i++) {
    if (!allProfiles.find((p) => p.fid === i)) {
      allProfiles.push({
        fid: i,
      })
    }
  }

  return allProfiles as Profile[]
}

/**
 * Helper function to build the profile endpoint with a cursor
 * @param cursor
 */
function buildProfileEndpoint(cursor?: string): string {
  return `https://api.warpcast.com/v2/recent-users?filter=off&limit=1000${
    cursor ? `&cursor=${cursor}` : ''
  }`
}
