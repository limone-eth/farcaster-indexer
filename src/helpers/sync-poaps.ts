import 'dotenv/config';
import {FarcasterUserPOAPsAndNFTsResult, Poap} from "./airstack/farcaster-enriched-profile/interfaces";
import supabase from "../supabase.js";
import {breakIntoChunks} from "../utils.js";
import {FlattenedPoapEvent, FlattenedProfile} from "../types";
import {fetchFarcasterUserPOAPs} from "./airstack/farcaster-enriched-profile/index.js";
import {init} from "@airstack/node";


export const syncPoaps = async () => {
    if (!process.env.AIRSTACK_API_KEY) throw new Error('AIRSTACK_API_KEY is not set');
    await init(process.env.AIRSTACK_API_KEY!, 'dev');
    const profiles = await supabase.from('profile').select("id", { count: 'exact', head: true });
    console.log(`[SYNCING POAPS] Total profiles: ${JSON.stringify(profiles.count)}`);
    let page = 0;
    let limit = 500;
    let doMore = true;
    do {
        // there will be #profiles / limit pages to process
        console.log(`\n[SYNCING POAPS] Page ${page} over ${Math.ceil(profiles!.count! / limit)}`)
        doMore = await syncPoapsForProfiles(page, limit);
        page++;
    } while (doMore)
}

// This function synchronizes POAPs for profiles in chunks.
// It fetches profiles, breaks them into smaller chunks, and processes each chunk of profiles.
// It fetches POAP data for each profile and performs necessary synchronization.
// Finally, it syncs the transformed data and returns whether all profiles have been processed.
export const syncPoapsForProfiles = async (page = 0, limit = 500) => {
    // Fetch profiles in a specified range
    const profiles = await supabase.from('profile').select('*').order('id', {ascending: true}).range(page * limit, (page + 1) * limit - 1);

    // Initialize an array to store processed data
    let data: FarcasterUserPOAPsAndNFTsResult[] = [];

    // Break profiles into smaller chunks
    const profileChunks = breakIntoChunks(profiles.data as FlattenedProfile[], 100);

    // Process each chunk of profiles
    for await (const profileChunk of profileChunks) {
        // Fetch POAP data for the current chunk of profiles
        const profileData = await fetchFarcasterUserPOAPs({
            farcasterFids: profileChunk.map((p) => `fc_fid:${p.id}`),
        });

        // Concatenate fetched POAP data
        data = data.concat(profileData);
    }

    // Transform the fetched data
    const transformedData = transformData(data);

    // Flatten and extract POAPs
    const poaps = Object.values(transformedData).flat();

    // Get unique POAP IDs
    const poapIds = poaps.map((p) => p.id);

    // Filter out duplicate POAPs
    const uniquePoaps: FlattenedPoapEvent[] = poaps.filter(function (elem, pos) {
        return poapIds.indexOf(elem.id) == pos;
    }).filter((p) => p.id);

    // Break unique POAPs into chunks and synchronize them
    const poapChunks = breakIntoChunks(uniquePoaps, 200);
    for await (const poapChunk of poapChunks) {
        await syncPoapEvents(poapChunk).catch(console.error);
    }

    // Synchronize profile and POAP association
    for await (const profileChunk of profileChunks) {
        const ids = profileChunk.map((p) => p.id);
        await Promise.all(ids.map(async (id) => syncProfilePoaps(id, transformedData[id.toString()]))).catch(console.error);
    }

    // Return whether all profiles have been processed
    return profiles.data!.length === limit;
}

// This function synchronizes a chunk of POAP events.
// It upserts the events into the 'poap_events' table, handling conflicts and duplicates.
export const syncPoapEvents = async (poaps: FlattenedPoapEvent[]) => {
    if (!poaps?.length) return;
    const {error} = await supabase.from('poap_events').upsert(poaps, {onConflict: "id", ignoreDuplicates: true});
    if (error) {
        console.error("[POAP_EVENTS]", error, poaps.map((p) => p.id));
    }
    return;
}

// This function synchronizes POAP events associated with a profile.
// It upserts the associations into the 'profile_has_poaps' table, handling duplicates.
export const syncProfilePoaps = async (profileId: number, poaps: FlattenedPoapEvent[]) => {
    if (!poaps?.length) return;
    const poapIds = poaps.map((p) => p.id);

    // Filter out duplicate POAPs
    const uniquePoaps: FlattenedPoapEvent[] = poaps.filter(function (elem, pos) {
        return poapIds.indexOf(elem.id) == pos;
    }).filter((p) => p.id);

    // Create profile-POAP associations
    const profilePoaps = uniquePoaps.map((poap) => ({
        profile_id: profileId,
        event_id: poap.id,
    }));

    // Upsert profile-POAP associations, handling duplicates
    const {data, error} = await supabase.from('profile_has_poaps').upsert(profilePoaps, {ignoreDuplicates: true});
    if (error) {
        console.error("[PROFILE_HAS_POAPS]", error);
    }
    return;
}

// This function transforms fetched POAP data into a structured format.
// It maps POAP data to user IDs and flattens the structure for further processing.
function transformData(data: FarcasterUserPOAPsAndNFTsResult[]): { [userId: string]: FlattenedPoapEvent[] } {
    return data
        .flatMap((datum) => datum.POAPs.Poap)
        .reduce((result: { [userId: string]: FlattenedPoapEvent[] }, item) => {
            if (!item) return result;
            const {owner} = item;
            const {userId} = owner.socials[0];

            // Initialize an array for the user's POAP events
            if (!result[userId]) {
                result[userId] = [];
            }

            // Convert and push the POAP event to the user's array
            result[userId].push(convertToFlattenedPoapEvent(item));
            return result;
        }, {});
}

// This function synchronizes transformed POAP data for multiple users.
// It fetches user IDs and synchronizes POAP events for each user.
async function syncTransformedData(data: { [userId: string]: FlattenedPoapEvent[] }) {
    const userIds = Object.keys(data);

    // Synchronize POAP events for each user
    await Promise.all(userIds.map(async (userId) => {
        await syncPoapEvents(data[userId]).catch(console.error);
    }));
}

// This function converts a complex POAP structure to a flattened format.
function convertToFlattenedPoapEvent(poap: Poap): FlattenedPoapEvent {
    const {
        owner: {socials},
        eventId,
        poapEvent: {
            eventName,
            eventURL,
            startDate,
            endDate,
            country,
            city,
            contentValue: {image},
        },
    } = poap;

    // Create a flattened POAP event object
    return {
        id: eventId,
        event_name: eventName ?? null,
        event_url: eventURL ?? null,
        start_date: startDate ?? null,
        end_date: endDate ?? null,
        country: country ?? null,
        city: city ?? null,
        image_url: image?.medium ?? null,
    };
}

syncPoaps().catch(console.error).then(() => process.exit(0));