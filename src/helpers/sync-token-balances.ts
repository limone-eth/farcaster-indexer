import 'dotenv/config';
import {init} from "@airstack/node";
import supabase from "../supabase.js";
import {FarcasterUserTokenBalancesResults, TokenBalance} from "./airstack/farcaster-enriched-profile/interfaces";
import {breakIntoChunks} from "../utils.js";
import {FlattenedProfile, FlattenedToken, TokenChain, TokenType} from "../types";
import {fetchFarcasterUserTokenBalances} from "./airstack/farcaster-enriched-profile/index.js";

export const syncTokenBalances = async () => {
    if (!process.env.AIRSTACK_API_KEY) throw new Error('AIRSTACK_API_KEY is not set');
    await init(process.env.AIRSTACK_API_KEY!, 'dev');
    const profiles = await supabase.from('profile').select("id", {count: 'exact', head: true});
    console.log(`[SYNCING TOKEN BALANCES] Total profiles: ${JSON.stringify(profiles.count)}`);
    let page = 90;
    let limit = 50;
    let doMore = true;
    do {
        // there will be #profiles / limit pages to process
        console.log(`\n[SYNCING TOKEN BALANCES] Page ${page} over ${Math.ceil(profiles!.count! / limit)}`)
        doMore = await syncTokenBalancesForProfiles(page, limit);
        page++;
    } while (doMore)
}

export const syncTokenBalancesForProfiles = async (page = 0, limit = 500) => {
    // Fetch profiles in a specified range
    const profiles = await supabase.from('profile').select('*').order('id', {ascending: true}).range(page * limit, (page + 1) * limit - 1);

    // Initialize an array to store processed data
    let data: FarcasterUserTokenBalancesResults[] = [];

    // Break profiles into smaller chunks
    const profileChunks = breakIntoChunks(profiles.data as FlattenedProfile[], 100);

    // Process each chunk of profiles
    for await (const profileChunk of profileChunks) {
        // Fetch POAP data for the current chunk of profiles
        const profileData = await fetchFarcasterUserTokenBalances({
            farcasterFids: profileChunk.map((p) => `fc_fid:${p.id}`),
        });
        console.log(`[SYNCING TOKEN BALANCES] Fetched ${profileData.length} profiles`)

        // Concatenate fetched POAP data
        data = data.concat(profileData);
    }

    // Transform the fetched data
    const transformedData = transformData(data);

    // Flatten and extract Tokens
    const tokens = Object.values(transformedData).flat();

    // Get unique Token Addresses
    const tokenAddresses = tokens.map((token) => token.address.toLowerCase());

    // Filter out duplicate Tokens
    const uniqueTokens: FlattenedToken[] = tokens.filter(function (elem, pos) {
        return tokenAddresses.indexOf(elem.address.toLowerCase()) == pos;
    }).filter((token) => token.address);

    // Break unique POAPs into chunks and synchronize them
    const tokenChunks = breakIntoChunks(uniqueTokens, 200);
    for await (const tokenChunk of tokenChunks) {
        await syncTokens(tokenChunk).catch(console.error);
    }

    // Synchronize profile and POAP association
    for await (const profileChunk of profileChunks) {
        const ids = profileChunk.map((p) => p.id);
        await Promise.all(ids.map(async (id) => syncProfileTokens(id, transformedData[id.toString()]))).catch(console.error);
    }

    // Return whether all profiles have been processed
    return profiles.data!.length === limit;
}

// This function synchronizes a chunk of Tokens.
// It upserts the events into the 'tokens' table, handling conflicts and duplicates.
export const syncTokens = async (tokens: FlattenedToken[]) => {
    if (!tokens?.length) return;
    const {error} = await supabase.from('tokens').upsert(tokens.map(t => {
        delete t.amount;
        return t;
    }), {onConflict: "address,token_chain", ignoreDuplicates: true});
    if (error) {
        console.error("[TOKENS]", error, tokens.map((t) => t.address));
    }
    return;
}

// This function synchronizes Tokens associated with a profile.
// It upserts the associations into the 'profile_has_tokens' table, handling duplicates.
export const syncProfileTokens = async (profileId: number, tokens: FlattenedToken[]) => {
    if (!tokens?.length) return;
    const tokenAddresses = tokens.map((token) => token.address.toLowerCase());

    // Filter out duplicate POAPs
    const uniqueTokens: FlattenedToken[] = tokens.filter(function (elem, pos) {
        return tokenAddresses.indexOf(elem.address) == pos;
    }).filter((p) => p.address);

    // Create profile-POAP associations
    const profileTokens = uniqueTokens.map((token) => ({
        profile_id: profileId,
        token_address: token.address,
        token_chain: token.token_chain,
        amount: token.amount ?? null,
    }));

    // Upsert profile-POAP associations, handling duplicates
    const {data, error} = await supabase.from('profile_has_tokens').upsert(profileTokens, {ignoreDuplicates: true});
    if (error) {
        console.error("[PROFILE_HAS_TOKENS]", error);
    }
    return;
}

// This function transforms fetched TokenBalances data into a structured format.
// It maps TokenBalance data to user IDs and flattens the structure for further processing.
function transformData(data: FarcasterUserTokenBalancesResults[]): {
    [userId: string]: FlattenedToken[]
} {
    const ethereumTokens = data.flatMap((d) => d.Ethereum?.TokenBalance);
    const polygonTokens = data.flatMap((d) => d.Polygon?.TokenBalance);
    const tokens = [
        ...ethereumTokens,
        ...polygonTokens,
    ]
    return tokens.reduce((result: { [userId: string]: FlattenedToken[] }, item) => {
            if (!item) return result;
            const {owner} = item;
            const {userId} = owner.socials[0];

            // Initialize an array for the user's POAP events
            if (!result[userId]) {
                result[userId] = [];
            }

            // Convert and push the POAP event to the user's array
            result[userId].push(convertToFlattenedToken(item));
            return result;
        }, {});
}

// This function converts a complex Token structure to a flattened format.
function convertToFlattenedToken(tokenBalance: TokenBalance): FlattenedToken {
    const {
        owner: {socials},
        tokenId,
        tokenType,
        tokenAddress,
        tokenNfts,
        amount,
    } = tokenBalance;


    // Create a flattened POAP event object
    return {
        image_url: tokenNfts?.contentValue?.image?.medium ?? null,
        collection_external_url: tokenNfts?.token?.projectDetails?.externalUrl ?? null,
        collection_name: tokenNfts?.token?.projectDetails.collectionName ?? null,
        collection_image_url: tokenNfts?.token?.projectDetails?.imageUrl ?? null,
        token_id: tokenId,
        token_type: tokenType as TokenType,
        address: tokenAddress,
        token_chain: tokenBalance.blockchain as TokenChain,
        amount: amount,
    };
}

syncTokenBalances().catch(console.error).then(() => process.exit(0));