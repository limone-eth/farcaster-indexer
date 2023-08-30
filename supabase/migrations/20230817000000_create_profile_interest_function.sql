ALTER TABLE profile
    DROP COLUMN IF EXISTS biots,
    ADD COLUMN biots tsvector GENERATED always AS (
        to_tsvector('english', bio)) stored;


DROP FUNCTION IF EXISTS public.get_profiles_by_interest(
    interest text, poap_event_ids integer[]);
DROP TYPE IF EXISTS enriched_profile;

CREATE TYPE enriched_profile AS (
    id bigint,
    username text,
    display_name text,
    avatar_url text,
    followers bigint,
    following bigint,
    bio text,
    referrer text,
    matching_casts text,
    matching_poaps text
    );

CREATE
OR REPLACE FUNCTION public.get_profiles_by_interest(
    interest text, poap_event_ids integer[])
RETURNS SETOF enriched_profile
LANGUAGE 'plpgsql'
COST 100
VOLATILE PARALLEL UNSAFE
ROWS 1000

AS $BODY$
BEGIN
  IF
array_length(poap_event_ids, 1) IS NULL THEN
    RETURN QUERY
SELECT p.id, p.username, p.display_name, p.avatar_url, p.followers, p.following, p.bio, p.referrer, string_agg(DISTINCT c.hash || '||' || c.text, '<>') AS matching_casts,
       null AS matching_poaps
FROM profile p
         INNER JOIN casts c ON c.author_fid = p.id
WHERE p.id = c.author_fid
  AND fts @@ to_tsquery(interest)
GROUP by p.id;
ELSE
    RETURN QUERY
SELECT p.id, p.username, p.display_name, p.avatar_url, p.followers, p.following, p.bio, p.referrer, string_agg(DISTINCT c.hash || '||' || c.text, '<>') AS matching_casts,
       string_agg(DISTINCT pe.id || '||' || pe.event_name, '<>') AS matching_poaps
FROM profile p
         INNER JOIN casts c ON c.author_fid = p.id
         INNER JOIN profile_has_poaps php ON php.profile_id = p.id
         INNER JOIN poap_events pe on php.event_id = pe.id
WHERE p.id = c.author_fid
  AND fts @@ to_tsquery(interest)
  AND php.event_id = ANY (poap_event_ids)
GROUP by p.id;
END IF;
END;
$BODY$;

ALTER FUNCTION public.get_profiles_by_interest(text, integer [])
    OWNER TO postgres;