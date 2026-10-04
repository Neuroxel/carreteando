-- V1: "¿Falta un lugar?" entra al mismo buzón de la comunidad (nunca se publica solo),
-- y las búsquedas sin resultado se cuentan agregadas por día, sin IP ni identidad.
alter table public.community_inbox drop constraint community_inbox_kind_check;
alter table public.community_inbox add constraint community_inbox_kind_check
  check (kind = any (array['submission','report','venue']));

create table if not exists public.search_misses (
  day date not null,
  query text not null check (length(query) between 2 and 60),
  count integer not null default 1,
  primary key (day, query)
);
alter table public.search_misses enable row level security;
revoke all on public.search_misses from anon, authenticated;

create or replace function public.count_search_miss(p_query text)
returns void
language plpgsql
set search_path to ''
as $$
DECLARE
  q text := lower(btrim(regexp_replace(p_query, '\s+', ' ', 'g')));
BEGIN
  -- Nada que parezca un dato personal: correos, teléfonos, enlaces.
  IF q IS NULL OR length(q) < 2 OR length(q) > 60 OR q ~ '@' OR q ~ '\d{6,}' OR q ~ '(https?:|www\.)' THEN
    RETURN;
  END IF;
  DELETE FROM public.search_misses WHERE day < (timezone('America/Santiago', now()))::date - 90;
  INSERT INTO public.search_misses(day, query, count)
  VALUES ((timezone('America/Santiago', now()))::date, q, 1)
  ON CONFLICT (day, query) DO UPDATE SET count = public.search_misses.count + 1;
END $$;
revoke all on function public.count_search_miss(text) from public, anon, authenticated;
grant execute on function public.count_search_miss(text) to service_role;

-- Un lugar propuesto se resuelve o se rechaza; nunca se "aprueba" como evento.
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.review_item'::regproc);
  IF position($x$IF old_item.kind='report' AND$x$ in d) = 0 THEN RAISE EXCEPTION 'review_item cambió: revisar a mano'; END IF;
  d := replace(d, $x$IF old_item.kind='report' AND$x$, $x$IF old_item.kind IN ('report','venue') AND$x$);
  EXECUTE d;
END
$do$;
