import 'dotenv/config'
import {cleanCasts, getAllCasts} from "../functions/index-casts.js";
import {FlattenedCast, FlattenedProfile} from "../types";
import {getAllProfiles} from "../functions/update-profiles.js";
import {syncProfilesOnPinecone} from "./pinecone/index.js";

console.log("Fetching profiles...")

const allProfiles = await getAllProfiles()

const formattedProfiles: FlattenedProfile[] = allProfiles.map((p) => {
    return {
        id: p.fid,
        username: p.username || null,
        display_name: p.displayName || null,
        avatar_url: p.pfp?.url || null,
        avatar_verified: p.pfp?.verified || false,
        followers: p.followerCount || null,
        following: p.followingCount || null,
        bio: p.profile?.bio?.text || null,
        referrer: p?.referrerUsername || null,
        updated_at: new Date(),
    }
})

console.log("Fetching casts...")

const allCasts = await getAllCasts(100000)

const cleanedCasts = cleanCasts(allCasts)

const formattedCasts: FlattenedCast[] = cleanedCasts.map((c) => {
    return {
        hash: c.hash,
        thread_hash: c.threadHash,
        parent_hash: c.parentHash || null,
        author_fid: c.author.fid,
        author_username: c.author.username || null,
        author_display_name: c.author.displayName,
        author_pfp_url: c.author.pfp?.url || null,
        author_pfp_verified: c.author.pfp?.verified || false,
        text: c.text,
        published_at: new Date(c.timestamp),
        mentions: c.mentions || null,
        replies_count: c.replies.count,
        reactions_count: c.reactions.count,
        recasts_count: c.recasts.count,
        watches_count: c.watches.count,
        parent_author_fid: c.parentAuthor?.fid || null,
        parent_author_username: c.parentAuthor?.username || null,
        deleted: false,
    }
});

console.log('Syncing profiles to Pinecone APIs...')
await syncProfilesOnPinecone(formattedProfiles, formattedCasts, 100)