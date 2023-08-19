import 'dotenv/config';
import {FarcasterUserPOAPsAndNFTsResult, Poap} from "./airstack/farcaster-enriched-profile/interfaces";
import supabase from "../supabase.js";
import {breakIntoChunks} from "../utils.js";
import {FlattenedPoapEvent, FlattenedProfile} from "../types";
import {fetchFarcasterUserPOAPs} from "./airstack/farcaster-enriched-profile/index.js";
import {init} from "@airstack/node";


export const poaps = async () => {
    await init(process.env.AIRSTACK_API_KEY!, 'dev');

    let page = 25;
    let doMore = true;
    do {
        console.log(`\n----- Page ${page} -----`)
        doMore = await syncPoapsForProfiles(page);
        page++;
    } while (doMore)
}

export const syncPoapsForProfiles = async (page = 0) => {
    const limit = 500;
    const profiles = await supabase.from('profile').select('*').order('id', {ascending: true}).range(page * limit, (page + 1) * limit - 1);
    let data: FarcasterUserPOAPsAndNFTsResult[] = [];
    const profileChunks = breakIntoChunks(profiles.data as FlattenedProfile[], 100);
    let numChunk = 0;
    for await (const profileChunk of profileChunks) {
        // console.time(`[TIME] Chunk ${numChunk}`);
        const profileData = await fetchFarcasterUserPOAPs({
            farcasterFids: profileChunk.map((p) => `fc_fid:${p.id}`),
        });
        data = data.concat(profileData);
        // console.log('\n');
        // console.timeEnd(`[TIME] Chunk ${numChunk}`);
        console.log(`- Chunk ${++numChunk}`);
    }
    const transformedData = transformData(data);
    const poaps = Object.values(transformedData).flat();
    const poapIds = poaps.map((p) => p.id);
    const uniquePoaps: FlattenedPoapEvent[] = poaps.filter(function(elem, pos) {
        return poapIds.indexOf(elem.id) == pos;
    }).filter((p) => p.id);
    const poapChunks = breakIntoChunks(uniquePoaps, 200);
    console.log("Syncing Poap Events...")
    for await (const poapChunk of poapChunks) {
        await syncPoapEvents(poapChunk).catch(console.error);
    }
    console.log("Syncing Profile Poaps...")
    for await (const profileChunk of profileChunks) {
        const ids = profileChunk.map((p) => p.id);
        await Promise.all(ids.map(async (id) => syncProfilePoaps(id, transformedData[id.toString()]))).catch(console.error);
    }
    return profiles.data!.length === limit;
}

export const syncPoapEvents = async (poaps: FlattenedPoapEvent[]) => {
    if (!poaps?.length) return;
    const {error} = await supabase.from('poap_events').upsert(poaps, {onConflict: "id", ignoreDuplicates: true});
    if (error) {
        console.error("[POAP_EVENTS]", error, poaps.map((p) => p.id));
    }
    return;
}

export const syncProfilePoaps = async (profileId: number, poaps: FlattenedPoapEvent[]) => {
    if (!poaps?.length) return;
    const poapIds = poaps.map((p) => p.id);
    const uniquePoaps: FlattenedPoapEvent[] = poaps.filter(function(elem, pos) {
        return poapIds.indexOf(elem.id) == pos;
    }).filter((p) => p.id);
    const profilePoaps = uniquePoaps.map((poap) => ({
        profile_id: profileId,
        event_id: poap.id,
    }));
    const {data, error} = await supabase.from('profile_has_poaps').upsert(profilePoaps, {ignoreDuplicates: true});
    if (error) {
        console.error("[PROFILE_HAS_POAPS]", error);
    }
    return;
}

function transformData(data: FarcasterUserPOAPsAndNFTsResult[]): { [userId: string]: FlattenedPoapEvent[] } {
    return data
        .flatMap((datum) => datum.POAPs.Poap)
        .reduce((result: { [userId: string]: FlattenedPoapEvent[] }, item) => {
            if (!item) return result;
            const {owner} = item;
            const {userId} = owner.socials[0];

            if (!result[userId]) {
                result[userId] = [];
            }

            result[userId].push(convertToFlattenedPoapEvent(item));
            return result;
        }, {});
}

async function syncTransformedData(data: { [userId: string]: FlattenedPoapEvent[] }) {
    const userIds = Object.keys(data);

    await Promise.all(userIds.map(async (userId) => {
        await syncPoapEvents(data[userId]).catch(console.error);
    }));
}

export function convertToFlattenedPoapEvent(poap: Poap): FlattenedPoapEvent {
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
            contentValue: {
                image
            }
        }
    } = poap;

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

poaps().catch(console.error).then(() => process.exit(0));