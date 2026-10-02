-- Cuando la misma ficha de la misma fuente cambia de fecha u hora, lo anterior
-- queda inactivo: es historia, no una segunda opinión.
create or replace function public.add_event_evidence(
  p_event_id bigint, p_source_id text, p_family text, p_origin text, p_authority text,
  p_url text, p_claims jsonb, p_structured boolean)
returns void language plpgsql security invoker set search_path to '' as $$
declare v_id bigint;
begin
  insert into public.event_evidence(event_id, source_id, source_family, origin_group, authority, source_url, claims, structured)
  values (p_event_id, p_source_id, p_family, p_origin, p_authority, p_url, p_claims, p_structured)
  on conflict (event_id, origin_group, authority, coalesce(source_url,''), (claims->>'date'),
               coalesce(claims->>'start_time',''), coalesce(claims->>'status',''))
  do update set retrieved_at = now(), active = true, claims = excluded.claims, source_id = excluded.source_id
  returning id into v_id;
  if p_url is not null then
    update public.event_evidence
       set active = false
     where event_id = p_event_id and origin_group = p_origin and authority = p_authority
       and source_url = p_url and id <> v_id and active;
  end if;
end $$;
revoke all on function public.add_event_evidence(bigint,text,text,text,text,text,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.add_event_evidence(bigint,text,text,text,text,text,jsonb,boolean) to service_role;
