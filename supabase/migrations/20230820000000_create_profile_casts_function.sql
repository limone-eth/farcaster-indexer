DROP FUNCTION IF EXISTS public.get_latest_casts(
    limit_count INT);

CREATE OR REPLACE FUNCTION get_latest_casts(limit_count INT)
RETURNS TABLE (
    profile_id BIGINT,
    profile_bio TEXT,
    profile_username TEXT,
    profile_display_name TEXT,
    all_casts_text TEXT  -- New column to aggregate casts text
) AS $$
BEGIN
RETURN QUERY (
    WITH RankedCasts AS (
            SELECT
                p.id,
                p.bio,
                p.username,
                p.display_name,
                c.text,
                ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY c.published_at DESC) AS rn
            FROM
                profile p
                INNER JOIN casts c ON c.author_fid = p.id
        )
        SELECT
            id,
        bio,
        username,
        display_name,
        STRING_AGG(text, ' ') AS all_casts_text  -- Aggregate casts text
        FROM
            RankedCasts
        WHERE
            rn <= limit_count
        GROUP BY
            id,
        bio,
        username,
        display_name
    );
END;
$$ LANGUAGE plpgsql;

