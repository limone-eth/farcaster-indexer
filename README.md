# Farcaster Indexer

Index all profiles and casts on the Farcaster protocol using [Warpcast APIs](https://api.warpcast.com/docs). Powers [Searchcaster](https://searchcaster.xyz/), [Fardrop](https://fardrop.xyz/) and others.

Soon, both profiles and casts will read from [Farcaster Hubs](https://github.com/farcasterxyz/protocol#4-hubs) instead of client APIs.

## How to run locally

Requirements: [Node.js](https://nodejs.org/en/download/), [Yarn](https://classic.yarnpkg.com/en/docs/install/), [Docker](https://docs.docker.com/get-docker/), [Supabase CLI](https://supabase.com/docs/guides/cli)

**In the project directory**, create a local Supabase instance. This will create all the tables for you.

```
supabase start
```

Rename `.env.example` to `.env` and configure your variables with the credentials generated from the previous step. Your `SUPABASE_URL` will be the `API URL` from the terminal output. The Studio URL is not necessary, but you may want to use it to view your database tables.

```
cp .env.example .env
```

If you don't have a Merkle auth token yet, set the `FC_MNEMONIC` environment variable to your Farcaster recovery phrase and run the following command to generate a token.

```
yarn install
yarn run auth
```

Seed your database with protocol data. This will take ~5-10 minutes for profiles and casts (default), or ~30 minutes for everything (include the `--verifications` flag).

```
yarn run seed
# or
yarn run seed --verifications
```

The Merkle APIs don't include a registration timestamp for users. For new registrations, we get the timestamp by watching events on the ID Registry contract. If you were running the previous version of this indexer, you can migrate this data. Otherwise you can skip this step.

```
yarn run migrate
```

Run the indexer

```
yarn start
```

### Note

Postgres full text search is a lot more performant and robust than pattern matching, especially when querying the `casts` table. It's a powerful search engine that can:

- stem words (e.g. "run" matches "runs", "running", and "ran")
- ignore stop words (e.g. "the" and "a")
- weight and rank results

The data can be queried with SQL or the Supabase client. For example, the following code will match casts that contain either "farcaster" and "warpast" OR "activitypub" and "mastodon".

```sql
SELECT *
FROM casts
WHERE fts @@ to_tsquery('english', '(farcaster & warpcast) | (activitypub & mastodon)')
```

```js
supabase
  .from('casts')
  .select()
  .textSearch('fts', '(farcaster & warpcast) | (activitypub & mastodon)')
```

See [full text search](https://supabase.com/docs/guides/database/full-text-search#creating-indexes) on Supabase for more details.

## Generate embeddings

To start generating embeddings for the Farcaster casts, you need to enable the **VECTOR** module on your Supabase database.

After you've done so, you need to create a new table with the following schema:

```sql
create table if not exists
  casts_embeddings (
    cast_hash TEXT primary key,
    embedding vector (384)
  )
```

The table is also created via the migrations.

When the table is created, you need to create a function called `match_casts` on the `public` schema:

```sql
create or replace function match_casts (
  query_embedding vector(384),
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
```

This function uses the cosine similarity to find the most similar casts to the query.

When the function is created, you need to create the index for the cosine similarity:

```sql
create index on casts_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 924);
```

The number after `list =` should be `# casts/1000` if less than 1M casts, otherwise it should be `sqrt(# casts)`.

When you have correctly setup the database, you just need to start creating the embeddings (make sure to have the casts in your database before!):

```bash
yarn run embeddings
```

Generating the embeddings is a slow process, and may take a while based on the number of casts you have in your database.

When the embeddings have been generated, you can start querying the database for similar casts:

```bash
yarn run search --text YOUR_TEXT --threshold 0.5 --count 10
```

The `--text` parameter is the text you want to search for, the `--threshold` is the minimum similarity threshold you want to use, and the `--count` is the number of results you want to get.

## How to deploy

Create an empty [Supabase](https://supabase.com/) project and connect to the CLI. If you get a warning that says "Local config differs from linked project", update the `major_version` in [supabase/config.toml](supabase/config.toml) to `15`.

```
supabase login
supabase link --project-ref <project-id>
```

Push your database schema

```
supabase db push
```

I recommend hosting the indexer on [Railway](https://railway.app?referralCode=ONtqGs).
