-- Piloto controlado de Instagram: lo que trae es pista privada, nunca evento.
create table if not exists public.instagram_pilot_items (
  id bigint generated always as identity primary key,
  apify_run_id text,
  account text not null,
  post_url text not null unique,
  posted_at timestamptz,
  caption text not null default '',
  post_type text,
  location_name text,
  classification text check (classification is null or classification in
    ('UNIQUE_VALID_EVENT','DUPLICATE_ALREADY_KNOWN','NOT_AN_EVENT','WRONG_DATE','OUTSIDE_REGION','AMBIGUOUS','STALE')),
  event_date text,
  matched_event_id bigint,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.instagram_pilot_runs (
  id bigint generated always as identity primary key,
  apify_run_id text,
  status text not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.instagram_pilot_items enable row level security;
alter table public.instagram_pilot_runs enable row level security;
revoke all on public.instagram_pilot_items, public.instagram_pilot_runs from anon, authenticated;
