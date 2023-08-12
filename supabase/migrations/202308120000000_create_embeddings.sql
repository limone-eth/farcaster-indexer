create table if not exists
  casts_embeddings (
    cast_hash TEXT primary key,
    embedding vector (384)
  )


create index on casts_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 924);