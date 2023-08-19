import {gql} from "@apollo/client/core/index.js";

export const getPOAPsQuery = gql`
query GetPOAPs {
  Poaps(input: {filter: {dappName: {_eq: poap}}, blockchain: ALL}) {
    Poap {
      eventId
      poapEvent {
        city
        contentValue {
          image {
            medium
          }
        }
        country
        endDate
        eventId
        eventName
        eventURL
        id
        startDate
      }
    }
  }
}
   `