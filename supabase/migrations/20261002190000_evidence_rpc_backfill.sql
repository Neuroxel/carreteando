-- La evidencia humana y la de la máquina pueden compartir origen (una ficha
-- editorial copiada de la ticketera): la autoridad forma parte de la identidad
-- de una evidencia, o la ingesta pisaría la ficha humana.
drop index if exists public.event_evidence_dedupe;
create unique index event_evidence_dedupe on public.event_evidence(
  event_id, origin_group, authority, coalesce(source_url,''), (claims->>'date'),
  coalesce(claims->>'start_time',''), coalesce(claims->>'status',''));

alter table public.events add column if not exists independent_sources integer not null default 0;

create or replace function public.add_event_evidence(
  p_event_id bigint, p_source_id text, p_family text, p_origin text, p_authority text,
  p_url text, p_claims jsonb, p_structured boolean)
returns void language sql security invoker set search_path to '' as $$
  insert into public.event_evidence(event_id, source_id, source_family, origin_group, authority, source_url, claims, structured)
  values (p_event_id, p_source_id, p_family, p_origin, p_authority, p_url, p_claims, p_structured)
  on conflict (event_id, origin_group, authority, coalesce(source_url,''), (claims->>'date'),
               coalesce(claims->>'start_time',''), coalesce(claims->>'status',''))
  do update set retrieved_at = now(), active = true, claims = excluded.claims, source_id = excluded.source_id;
$$;
revoke all on function public.add_event_evidence(bigint,text,text,text,text,text,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.add_event_evidence(bigint,text,text,text,text,text,jsonb,boolean) to service_role;

-- Relleno: cada evento existente aporta la evidencia de la fuente que lo trajo.
with base as (
  select e.*,
    coalesce(e.source_detail_url, e.instagram_url) as url,
    substring(coalesce(e.source_detail_url, e.instagram_url) from 'https?://(?:www\.)?([^/]+)') as host,
    substring(coalesce(e.source_detail_url, e.instagram_url) from 'instagram\.com/([^/?]+)') as handle
  from public.events e
)
insert into public.event_evidence(event_id, source_id, source_family, origin_group, authority, source_url, retrieved_at, claims, structured)
select b.id, b.source_id,
  case
    when b.source = 'editorial' then 'EDITORIAL'
    when b.source_id like 'portaldisc-%' then 'TICKET_PLATFORM'
    when b.source_id = 'pcdv-agenda' then 'CULTURAL_CENTER'
    when b.source_id = 'cinzano-agenda' then 'VENUE_OFFICIAL'
    when b.source_id like 'muni%' then 'MUNICIPALITY'
    when b.host = 'passline.com' then 'TICKET_PLATFORM'
    else 'COMMUNITY' end,
  case
    when b.source_id like 'portaldisc-%' or b.host = 'portaldisc.com' then 'portaldisc'
    when b.host = 'instagram.com' and b.handle not in ('p','reel') then 'instagram:' || b.handle
    when b.host = 'instagram.com' then 'instagram:' || b.source
    else coalesce(b.host, b.source_id, b.source) end,
  case
    when b.source = 'editorial' then 'human'
    when b.source = 'passline' and b.moderation_status = 'approved' and b.host = 'passline.com' then 'human'
    when b.source_id in ('pcdv-agenda','cinzano-agenda') then 'first_party'
    when b.source_id like 'portaldisc-%' or b.host = 'passline.com' then 'transactional'
    when b.source_id like 'muni%' then 'directory'
    else 'lead' end,
  b.url,
  coalesce(b.scraped_at, now()),
  jsonb_strip_nulls(jsonb_build_object(
    'title', b.title, 'date', b.date_text, 'start_time', b.event_time, 'venue', b.venue, 'city', b.city,
    'status', 'scheduled',
    'date_verified', case
      when b.source_id in ('pcdv-agenda','cinzano-agenda') then true
      when b.source_id like 'portaldisc-%' then (
        substring(b.description from '\m(20\d\d)\M') = left(b.date_text, 4)
        and lower(translate(split_part(b.description, ' ', 1), 'áéíóú', 'aeiou')) =
            (array['domingo','lunes','martes','miercoles','jueves','viernes','sabado'])[extract(dow from b.date_text::date)::int + 1])
      else false end)),
  coalesce(b.source_id in ('pcdv-agenda','cinzano-agenda'), false)
from base b
where b.date_text ~ '^\d{4}-\d{2}-\d{2}$'
on conflict do nothing;

-- La misma ficha de la ticketera entró dos veces (editorial y adaptador): la
-- evidencia del adaptador pasa a la ficha humana y la copia queda como duplicado.
insert into public.event_evidence(event_id, source_id, source_family, origin_group, authority, source_url, retrieved_at, claims, structured)
select h.id, ev.source_id, ev.source_family, ev.origin_group, ev.authority, ev.source_url, ev.retrieved_at, ev.claims, ev.structured
from public.events a
join public.events h on coalesce(h.source_detail_url, h.instagram_url) = coalesce(a.source_detail_url, a.instagram_url)
join public.event_evidence ev on ev.event_id = a.id
where a.source = 'adapter' and h.source = 'editorial' and a.id <> h.id
on conflict do nothing;
update public.events a
   set disposition = 'duplicate', is_active = false, disposition_at = now(),
       disposition_note = 'Misma ficha de la ticketera que el evento ' || h.id || '; su evidencia pasó a ese evento.'
  from public.events h
 where coalesce(h.source_detail_url, h.instagram_url) = coalesce(a.source_detail_url, a.instagram_url)
   and a.source = 'adapter' and h.source = 'editorial' and a.id <> h.id
   and a.disposition = 'review';
