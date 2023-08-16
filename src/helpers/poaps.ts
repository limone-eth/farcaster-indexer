import 'dotenv/config';
import {FarcasterUserPOAPsAndNFTsResult, Poap} from "./airstack/farcaster-enriched-profile/interfaces";
import supabase from "../supabase.js";
import {breakIntoChunks} from "../utils.js";
import {FlattenedPoapEvent, FlattenedProfile} from "../types";
import {fetchFarcasterUserPOAPs} from "./airstack/farcaster-enriched-profile/index.js";
import {init} from "@airstack/node";


export const poaps = async () => {
    await init(process.env.AIRSTACK_API_KEY!, 'dev');
    const profiles = await supabase.from('profile').select('*').order('id', {ascending: true});
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
        console.log(`\n-----Chunk ${++numChunk}-----`);
    }
    const transformedData = data
        .map((datum) => datum.POAPs.Poap)
        .flat()
        .reduce((result: { [userId: string]: FlattenedPoapEvent[] }, item) => {
            const {owner} = item;
            const {userId} = owner.socials[0];

            // Create an object indexed by userId
            if (!result[userId]) {
                result[userId] = [];
            }

            result[userId].push(convertToFlattenedPoapEvent(item));
            return result;
        }, {});


    for await (const profileChunk of profileChunks) {
        const ids = profileChunk.map((p) => p.id);
        await Promise.all(ids.map(async (id) => syncPoaps(id.toString(), transformedData[id.toString()]))).catch(console.error);
    }
}

export const syncPoaps = async (profileId: string, poap: FlattenedPoapEvent[]) => {
    if (!poap?.length) return;
    await Promise.all(poap.map(async (p) => syncPoap(profileId, p)));
}

export const syncPoap = async (profileId: string, poap: FlattenedPoapEvent) => {
    let {data, error} = await supabase.from('poap_events').upsert(poap);
    if (error) {
        console.error(error);
    }
    const res = await supabase.from('profile_has_poaps').upsert({
        profile_id: profileId,
        event_id: poap.id,
    })
    if (res.error) {
        console.error(res.error);
    }
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
        event_name: eventName,
        event_url: eventURL,
        start_date: startDate,
        end_date: endDate,
        country,
        city,
        image_extra_small: image?.extraSmall,
        image_small: image?.small,
        image_large: image?.large,
        image_medium: image?.medium,
        image_original: image?.original,
    };
}

poaps().catch(console.error).finally(() => process.exit(0));