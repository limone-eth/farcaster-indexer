import got from 'got'

import { MERKLE_REQUEST_OPTIONS } from '../merkle.js'
import { MerkleResponse } from '../types/index.js'

export const getCurrentUser = async () => {
  const _response = await got(
    buildCastEndpoint(),
    MERKLE_REQUEST_OPTIONS
  ).json()

  const response = _response as MerkleResponse

  return response.result.user
}

function buildCastEndpoint(): string {
  return `https://api.warpcast.com/v2/me`
}
