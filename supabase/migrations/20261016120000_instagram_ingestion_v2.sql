-- Ingesta de Instagram v2: registro de cuentas y evidencia cruda privada.
-- Instagram es pista, no verdad: nada de esto publica eventos por sí solo.

-- 1. Registro de cuentas (lugares y no-lugares). Una cuenta citada que no
--    conocemos entra como 'candidate'; solo una persona o una regla de
--    evidencia explícita la pasa a 'active' o 'rejected'.
create table if not exists public.instagram_accounts (
  username text primary key check (username ~ '^[a-z0-9._]{1,30}$'),
  kind text not null default 'other' check (kind in
    ('venue','centro_alumnos','universidad','centro_cultural','productora','colectivo','promotor','banda_artista','fiesta_recurrente','other')),
  status text not null default 'candidate' check (status in ('active','candidate','rejected','paused')),
  venue_id bigint references public.venues(id) on delete set null,
  city text,
  origin text not null default 'manual',          -- 'venue_master', 'mention:<cuenta>', 'search', 'manual'
  origin_accounts text[] not null default '{}',    -- cuentas que la citaron (sin recorrer seguidores)
  appearances integer not null default 0,          -- apariciones independientes (cuentas distintas)
  last_post_at timestamptz,
  last_scraped_at timestamptz,
  last_checked_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists instagram_accounts_status on public.instagram_accounts (status);
alter table public.instagram_accounts enable row level security;
revoke all on public.instagram_accounts from anon, authenticated;

-- 2. Evidencia cruda: se extiende la tabla privada del piloto en vez de crear otra base.
alter table public.instagram_pilot_items
  add column if not exists mentions text[] not null default '{}',
  add column if not exists tagged_users text[] not null default '{}',
  add column if not exists coauthors text[] not null default '{}',
  add column if not exists display_url_temp text,           -- vence en horas; se borra a los 2 días
  add column if not exists retrieved_at timestamptz not null default now(),
  add column if not exists actor text,
  add column if not exists cohort text,
  add column if not exists candidate jsonb,                 -- extracción del texto (metadato, no decisión)
  add column if not exists outcome text;
alter table public.instagram_pilot_runs
  add column if not exists cohort text,
  add column if not exists actor text;

-- 3. Las URLs de imagen de Instagram vencen y no se guardan: limpieza diaria.
create or replace function public.purge_instagram_media_urls() returns integer
language sql security definer set search_path = '' as $$
  with u as (
    update public.instagram_pilot_items set display_url_temp = null
    where display_url_temp is not null and retrieved_at < now() - interval '2 days'
    returning 1)
  select count(*)::int from u;
$$;
revoke all on function public.purge_instagram_media_urls() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('carreteando-purga-media-instagram', '45 4 * * *', 'select public.purge_instagram_media_urls()');
  end if;
end $$;
