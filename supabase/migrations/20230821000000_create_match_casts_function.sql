DROP FUNCTION IF EXISTS public.match_casts(
    query_embedding vector(384), /* vector(1536) for OpenAI embeddings */
    match_threshold float,
    match_count int);

create or replace function match_casts (
  query_embedding vector(384), /* vector(1536) for OpenAI embeddings */
  match_threshold float,
  match_count int
)
returns table (
  cast_hash text,
  similarity float
)
language sql stable
as $$
select
    casts_embeddings.cast_hash,
    1 - (casts_embeddings.embedding <=> query_embedding) as similarity
from casts_embeddings
where 1 - (casts_embeddings.embedding <=> query_embedding) > match_threshold
order by similarity desc
    limit match_count;
$$;