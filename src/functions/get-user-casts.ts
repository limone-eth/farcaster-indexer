import got from 'got'

import { MERKLE_REQUEST_OPTIONS } from '../merkle.js'
import { MerkleResponse } from '../types/index.js'

export const getUserCasts = async (fid: number) => {
  const _response = await got(
    buildCastEndpoint(fid),
    MERKLE_REQUEST_OPTIONS
  ).json()

  const response = _response as MerkleResponse

  return response.result.casts
}

function buildCastEndpoint(fid: number): string {
  return `https://api.warpcast.com/v2/casts?fid=${fid}`
}