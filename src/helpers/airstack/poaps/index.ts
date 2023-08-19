import {POAPsResult} from "./interface";
import {FetchQuery} from "@airstack/node/dist/types/types";
import {fetchQueryWithPagination} from "@airstack/node";
import {gqlToString} from "../../../utils.js";
import {getPOAPsQuery} from "./query.js";

export const fetchPoaps = async (): Promise<POAPsResult[]> => {
    const allData: POAPsResult[] = [];

    // Fetch the first page of data
    let response: FetchQuery | null = await fetchQueryWithPagination(gqlToString(getPOAPsQuery));

    // Handle error for the first page
    if (response.error) {
        console.error(response.error);
        await delay(1000);
        return fetchPoaps();
    }

    // Store the data from the first page
    allData.push(response.data);

    // Determine whether to fetch the next page
    let shouldFetchNextPage = response.hasNextPage;

    // Counter to track the number of API calls
    // let numCalls = 1;

    // Fetch subsequent pages until there are no more pages
    while (shouldFetchNextPage) {
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
        console.log(allData.length)
    }

    return allData;
}

// eslint-disable-next-line no-promise-executor-return
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));