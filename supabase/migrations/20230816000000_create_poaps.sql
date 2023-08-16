-- Create POAPs table
CREATE TABLE IF NOT EXISTS public.poap_events
(
    id                bigint NOT NULL,
    event_name        varchar,
    event_url         varchar,
    start_date        varchar,
    end_date          varchar,
    country           varchar,
    city              varchar,
    image_extra_small varchar,
    image_small       varchar,
    image_large       varchar,
    image_medium      varchar,
    image_original    varchar,
    updated_at        timestamp with time zone DEFAULT now(),
    CONSTRAINT poap_events_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.profile_has_poaps
(
    profile_id bigint NOT NULL references public.profile,
    event_id   bigint NOT NULL references public.poap_events,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profile_has_poaps_pkey PRIMARY KEY (profile_id, event_id)
);
