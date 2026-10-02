-- Octubre: las fuentes dejan de ser solo "auto o revisión". Cada una declara a
-- qué familia pertenece, qué nivel de confianza tiene y cómo se accede a ella,
-- y el panel mide cuánto de lo que trae sirve de verdad para salir de noche.
alter table public.event_sources
  add column if not exists family text,
  add column if not exists trust_tier text,
  add column if not exists access_mode text not null default 'api',
  add column if not exists relevance_filter boolean not null default false,
  add column if not exists relevant_count integer not null default 0,
  add column if not exists irrelevant_count integer not null default 0,
  add column if not exists notes text;

alter table public.event_sources drop constraint if exists event_sources_family;
alter table public.event_sources add constraint event_sources_family check (
  family is null or family = any (array[
    'VENUE_OFFICIAL','UNIVERSITY_OFFICIAL','STUDENT_ORGANIZATION','CULTURAL_CENTER',
    'AUTOGESTIONADO','PROMOTER','COLLECTIVE','ARTIST_OR_BAND','MUNICIPALITY',
    'TICKET_PLATFORM','PUBLIC_EVENT_DIRECTORY','COMMUNITY','EDITORIAL']));
alter table public.event_sources drop constraint if exists event_sources_tier;
alter table public.event_sources add constraint event_sources_tier check (
  trust_tier is null or trust_tier = any (array['A','B','C','D']));
alter table public.event_sources drop constraint if exists event_sources_access;
alter table public.event_sources add constraint event_sources_access check (
  access_mode = any (array['api','html','feed','manual','blocked']));

-- 'strict': publica solo si la noche está escrita sin ambigüedad (año explícito
-- o fecha cercana, hora de noche, local conocido y sin duplicado). Todo lo
-- demás va a la cola.
alter table public.event_sources drop constraint if exists event_sources_trust;
alter table public.event_sources add constraint event_sources_trust check (
  trust = any (array['auto','strict','review','evidence']));

alter table public.ingestion_source_runs
  add column if not exists irrelevant integer not null default 0;

alter table public.events
  add column if not exists relevance text,
  add column if not exists relevance_reasons text;
alter table public.events drop constraint if exists events_relevance;
alter table public.events add constraint events_relevance check (
  relevance is null or relevance = any (array['NIGHTLIFE_HIGH','CULTURAL_NIGHT','REVIEW','IRRELEVANT']));

-- La cola se pudría: lo que nadie revisó antes de su fecha quedaba "en
-- revisión" para siempre y lo publicado que ya pasó seguía contando como
-- público. Un barrido diario deja cada fila en el estado que de verdad tiene.
create or replace function public.sweep_stale_events()
returns integer
language plpgsql
security invoker
set search_path to ''
as $$
declare
  hoy text := to_char(timezone('America/Santiago', now()), 'YYYY-MM-DD');
  n integer;
begin
  update public.events
     set disposition = 'expired',
         disposition_at = now(),
         disposition_note = case
           when disposition = 'review' then 'La fecha pasó sin que nadie lo revisara.'
           else 'La fecha ya pasó.' end,
         is_active = false
   where disposition in ('review','public')
     and date_text is not null
     and date_text < hoy;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.sweep_stale_events() from public, anon, authenticated;
grant execute on function public.sweep_stale_events() to service_role;

select cron.schedule('carreteando-barrido-vencidos', '15 4 * * *', $$select public.sweep_stale_events()$$);

-- La disposición solo se calculaba al insertar: aprobar un evento de la cola lo
-- dejaba visible y "en revisión" a la vez, y la expiración diaria no lo movía.
-- Ahora se recalcula cuando cambia la moderación o la visibilidad, salvo que
-- quien actualiza fije una disposición explícita.
create or replace function public.set_event_disposition()
returns trigger
language plpgsql
set search_path to ''
as $$
BEGIN
  IF NEW.disposition IS NULL
     OR (TG_OP = 'UPDATE'
         AND NEW.disposition IS NOT DISTINCT FROM OLD.disposition
         AND NEW.disposition NOT IN ('duplicate','cancelled')
         AND (NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
              OR NEW.is_active IS DISTINCT FROM OLD.is_active)) THEN
    NEW.disposition := CASE
      WHEN NEW.is_active AND NEW.moderation_status = 'approved' THEN 'public'
      WHEN NEW.moderation_status = 'rejected' THEN 'rejected'
      WHEN NEW.date_text IS NULL THEN 'expired'
      WHEN NEW.date_text < to_char(timezone('America/Santiago', now()), 'YYYY-MM-DD') THEN 'expired'
      ELSE 'review' END;
    NEW.disposition_at := now();
    IF NEW.disposition = 'review' AND NEW.disposition_note IS NULL THEN
      NEW.disposition_note := 'Encontrado automáticamente, a la espera de revisión.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
