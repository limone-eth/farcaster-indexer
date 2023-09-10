import 'dotenv/config'

import { getCastsRecommendations } from '../functions/recommend.js'
import supabase from "../supabase.js";

const userFid = 4461

const {data: casts, error} = await supabase.from("casts").select("*").eq("author_fid", userFid).limit(50).order("published_at", {ascending: false})

if (!casts) {
  throw new Error('No casts found by the user')
}

console.log(`Found ${casts.length} casts by the user`)

const recommendations = await getCastsRecommendations(casts.filter(c => c.text.length > 15))

console.log(`Recommended ${recommendations.length} casts`)
console.log(recommendations);
