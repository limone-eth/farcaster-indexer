import { fetchQueryWithPagination } from '@airstack/node';

import { FarcasterUserPOAPsAndNFTsResult, FarcasterUserPOAPsAndNFTsVariables } from './interfaces';
import { FarcasterUserPOAPsAndNFTsQuery, FarcasterUserPOAPsQuery } from './query.js';
import {gqlToString} from "../../../utils.js";
import {FetchQuery} from "@airstack/node/dist/types/types";

/**
 * Fetches user POAPs and NFTs data using pagination.
 * @param variables - The variables for the GraphQL query.
 * @returns An array of results containing data from all pages.
 */
export const fetchFarcasterUserPOAPsAndNFTs = async (
  variables: FarcasterUserPOAPsAndNFTsVariables
): Promise<FarcasterUserPOAPsAndNFTsResult[]> => {
  const allData: FarcasterUserPOAPsAndNFTsResult[] = [];

  // Fetch the first page of data
  let response: FetchQuery | null = await fetchQueryWithPagination(gqlToString(FarcasterUserPOAPsAndNFTsQuery), variables);

  // Handle error for the first page
  if (response.error) {
    console.error(response.error);
    await delay(1000);
    return fetchFarcasterUserPOAPsAndNFTs(variables);
  }

  // Store the data from the first page
  allData.push(response.data);

  // Determine whether to fetch the next page
  let shouldFetchNextPage = response.hasNextPage;

  // Counter to track the number of API calls
  // let numCalls = 1;

  // Fetch subsequent pages until there are no more pages
  while (shouldFetchNextPage) {
    console.time('fetchFarcasterUserPOAPsAndNFTs');
    // Fetch the next page of data
    // eslint-disable-next-line no-await-in-loop
    response = await response!.getNextPage();

    // Break the loop if there's an error fetching the next page
    if (response!.error) {
      break;
    }

    // Update the flag to determine whether to continue fetching
    shouldFetchNextPage = response!.hasNextPage;

    // Store the data from the current page
    allData.push(response!.data);

    // Log the number of API calls (optional)
    // console.log(`${variables.farcasterFids} API calls: ${numCalls++}`);
    console.timeEnd('fetchFarcasterUserPOAPsAndNFTs');
  }

  return allData;
};

/**
 * Fetches user POAPs and NFTs data using pagination.
 * @param variables - The variables for the GraphQL query.
 * @returns An array of results containing data from all pages.
 */
export const fetchFarcasterUserPOAPs = async (
  variables: FarcasterUserPOAPsAndNFTsVariables
): Promise<FarcasterUserPOAPsAndNFTsResult[]> => {
  const allData: FarcasterUserPOAPsAndNFTsResult[] = [];

  // Fetch the first page of data
  let response: FetchQuery | null = await fetchQueryWithPagination(gqlToString(FarcasterUserPOAPsQuery), variables);

  // Handle error for the first page
  if (response.error) {
    console.error(response.error);
    await delay(1000);
    return fetchFarcasterUserPOAPsAndNFTs(variables);
  }

  // Store the data from the first page
  allData.push(response.data);

  // Determine whether to fetch the next page
  let shouldFetchNextPage = response.hasNextPage;

  // Counter to track the number of API calls
  // let numCalls = 1;

  // Fetch subsequent pages until there are no more pages
  while (shouldFetchNextPage) {
    // console.time('fetchFarcasterUserPOAPs');
    // Fetch the next page of data
    // eslint-disable-next-line no-await-in-loop
    response = await response!.getNextPage();

    // Break the loop if there's an error fetching the next page
    if (response!.error) {
      break;
    }

    // Update the flag to determine whether to continue fetching
    shouldFetchNextPage = response!.hasNextPage;

    // Store the data from the current page
    allData.push(response!.data);

    // Log the number of API calls (optional)
    // console.log(`${variables.farcasterFids} API calls: ${numCalls++}`);
    // console.timeEnd('fetchFarcasterUserPOAPs');
  }

  return allData;
};

// eslint-disable-next-line no-promise-executor-return
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
