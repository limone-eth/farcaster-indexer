-- Create Token table
CREATE TABLE IF NOT EXISTS public.tokens
(
    id                SERIAL PRIMARY KEY,
    address           VARCHAR(255) NOT NULL,
    token_chain       VARCHAR(255) NOT NULL,
    token_id          VARCHAR(255),
    token_type        VARCHAR(255),
    collection_name   VARCHAR(255),
    collection_image_url VARCHAR(255),
    collection_external_url VARCHAR(255),
    image_url         VARCHAR(255),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

-- Add unique constraint to public.tokens
ALTER TABLE public.tokens
    ADD CONSTRAINT tokens_unique_address_chain UNIQUE (address, token_chain);

-- Create Profile has Tokens table
CREATE TABLE IF NOT EXISTS public.profile_has_tokens
(
    profile_id BIGINT NOT NULL REFERENCES public.profile (id),
    token_address VARCHAR(255) NOT NULL,
    token_chain VARCHAR(255) NOT NULL,
    amount     BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT profile_has_tokens_pkey PRIMARY KEY (profile_id, token_address, token_chain),
    CONSTRAINT fk_profile FOREIGN KEY (profile_id) REFERENCES public.profile (id),
    CONSTRAINT fk_token FOREIGN KEY (token_address, token_chain) REFERENCES public.tokens (address, token_chain)
    );
