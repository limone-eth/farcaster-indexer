import {gql} from '@apollo/client/core/index.js';

export const FarcasterUserPOAPsAndNFTsQuery = gql`
  query FarcasterUserPOAPsAndNFTs($farcasterFids: [Identity!]!) {
    EthereumNFT: TokenBalances(
      input: {
        filter: { owner: { _in: $farcasterFids }, tokenType: { _in: [ERC721, ERC1155] } }
        blockchain: ethereum
        limit: 200
      }
    ) {
      TokenBalance {
        owner {
          socials(input: { filter: { dappName: { _eq: farcaster } } }) {
            profileName
            userId
          }
        }
        tokenNfts {
          address
          tokenId
          contentValue {
            image {
              extraSmall
              large
              medium
              small
            }
          }
        }
      }
    }
    PolygonNFT: TokenBalances(
      input: {
        filter: { owner: { _in: $farcasterFids }, tokenType: { _in: [ERC721, ERC1155] } }
        blockchain: polygon
        limit: 200
      }
    ) {
      TokenBalance {
        owner {
          socials(input: { filter: { dappName: { _eq: farcaster } } }) {
            profileName
            userId
          }
        }
        tokenNfts {
          address
          tokenId
          contentValue {
            image {
              extraSmall
              large
              medium
              small
            }
          }
        }
      }
    }
    POAPs: Poaps(input: { filter: { owner: { _in: $farcasterFids } }, limit: 200, blockchain: ALL }) {
      Poap {
        owner {
          socials(input: { filter: { dappName: { _eq: farcaster } } }) {
            profileName
            userId
          }
        }
        eventId
        poapEvent {
          eventName
          eventURL
          startDate
          endDate
          country
          city
          contentValue {
            image {
              extraSmall
              large
              medium
              original
              small
            }
          }
        }
      }
    }
  }
`;

export const FarcasterUserPOAPsQuery = gql`
  query FarcasterUserPOAPs($farcasterFids: [Identity!]!) {
    POAPs: Poaps(input: { filter: { owner: { _in: $farcasterFids } }, limit: 200, blockchain: ALL }) {
      Poap {
        owner {
          socials(input: { filter: { dappName: { _eq: farcaster } } }) {
            profileName
            userId
          }
        }
        eventId
        poapEvent {
          eventName
          eventURL
          startDate
          endDate
          country
          city
          contentValue {
            image {
              extraSmall
              large
              medium
              original
              small
            }
          }
        }
      }
    }
  }
`;

export const FarcasterUserNFTsQuery = gql`
query NFTsOwnedByFarcasterUser($farcasterFids: [Identity!]) {
  Ethereum: TokenBalances(
    input: {filter: {owner: {_in: $farcasterFids}, tokenType: {_in: [ERC721]}}, blockchain: ethereum, limit: 50}
  ) {
    TokenBalance {
      owner {
        socials(input: {filter: {dappName: {_eq: farcaster}}}) {
          profileName
          userId
          userAssociatedAddresses
        }
      }
      amount
      tokenAddress
      tokenId
      tokenType
      blockchain
      tokenNfts {
        contentValue {
          image {
            medium
            original
          }
        }
        token {
          projectDetails {
            collectionName
            imageUrl
            externalUrl
          }
        }
      }
    }
    pageInfo {
      nextCursor
      prevCursor
    }
  }
  Polygon: TokenBalances(
    input: {filter: {owner: {_in: $farcasterFids}, tokenType: {_in: [ERC721]}}, blockchain: polygon, limit: 50}
  ) {
    TokenBalance {
      owner {
        socials(input: {filter: {dappName: {_eq: farcaster}}}) {
          profileName
          userId
          userAssociatedAddresses
        }
      }
      amount
      tokenAddress
      tokenId
      tokenType
      blockchain
      tokenNfts {
        contentValue {
          image {
            medium
            original
          }
        }
        token {
          projectDetails {
            collectionName
            imageUrl
            externalUrl
          }
        }
      }
    }
    pageInfo {
      nextCursor
      prevCursor
    }
  }
}
`