-- Censo de locales V2: procedencia por campo, horario y precio solo con fuente y fecha.
-- (Aplicada en producción el 2026-10-04 junto con las correcciones del censo de Barrio
-- Cumming y la carga de candidatos de OpenStreetMap; ver docs/CENSO_LOCALES.md.)
alter table public.venues
  add column if not exists field_sources jsonb not null default '{}'::jsonb,
  add column if not exists hours_text text,
  add column if not exists hours_source text,
  add column if not exists hours_verified_at date,
  add column if not exists price_tier smallint,
  add column if not exists price_source text,
  add column if not exists price_verified_at date;
alter table public.venues drop constraint if exists venues_price_tier;
alter table public.venues add constraint venues_price_tier check (
  price_tier is null or (price_tier between 1 and 4 and price_source is not null and price_verified_at is not null));
alter table public.venues drop constraint if exists venues_hours_sourced;
alter table public.venues add constraint venues_hours_sourced check (
  hours_text is null or (hours_source is not null and hours_verified_at is not null));
grant select (field_sources, hours_text, hours_source, hours_verified_at, price_tier, price_source, price_verified_at)
  on public.venues to anon, authenticated;
