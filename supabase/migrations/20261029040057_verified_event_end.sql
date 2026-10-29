-- Sin BEGIN/COMMIT propios: la CLI de Supabase aplica cada migración en su transacción.
-- Optional, source-verified Chile local end time. A smaller time than start is
-- interpreted as the following day. Multi-day events need an explicit end date.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_end_time text;
ALTER TABLE public.events ADD CONSTRAINT events_end_time_valid CHECK (
  event_end_time IS NULL OR (
    event_end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND event_time IS NOT NULL
    AND event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND event_end_time <> event_time
  )
);

-- Preserve the actual deployed function and its privileges. Only extend its
-- audited update; older callers that omit the field retain the existing value.
DO $migration$
DECLARE
  definition text;
  old_fragment text := $old$event_time=p_fields->>'event_time',venue=$old$;
  new_fragment text := $new$event_time=p_fields->>'event_time',event_end_time=CASE WHEN p_fields ? 'event_end_time' THEN nullif(p_fields->>'event_end_time','') ELSE old_event.event_end_time END,venue=$new$;
BEGIN
  SELECT pg_get_functiondef('public.review_item(text,text,bigint,text,text,jsonb,text)'::regprocedure) INTO definition;
  IF position(old_fragment IN definition) = 0 THEN
    RAISE EXCEPTION 'review_item differs from expected definition; inspect before migration';
  END IF;
  EXECUTE replace(definition, old_fragment, new_fragment);
END
$migration$;

-- Only the previous night with an explicitly verified end after the current
-- Chilean time survives the 05:00 cutoff. Pure invoker function, no secret data.
CREATE OR REPLACE FUNCTION public.event_ongoing_after_night_cutoff(
  p_date text, p_start text, p_end text, p_now timestamptz
) RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $body$
  SELECT coalesce(
    p_date = to_char((timezone('America/Santiago', p_now)::date - 1), 'YYYY-MM-DD')
    AND to_char(timezone('America/Santiago', p_now), 'HH24:MI') >= '05:00'
    AND p_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND p_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND p_end < p_start
    AND p_end > to_char(timezone('America/Santiago', p_now), 'HH24:MI'), false);
$body$;
REVOKE ALL ON FUNCTION public.event_ongoing_after_night_cutoff(text,text,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_ongoing_after_night_cutoff(text,text,text,timestamptz) TO anon, authenticated, service_role;

-- Additional permissive policy covers only still-running approved events.
CREATE POLICY "Public verified overnight end" ON public.events FOR SELECT TO anon, authenticated
USING (is_active AND moderation_status = 'approved'
  AND public.event_ongoing_after_night_cutoff(date_text,event_time,event_end_time,now()));

-- Preserve deployed function bodies and fail closed if they differ from the
-- reviewed revision; neither sweep nor status trigger may expire a live event.
DO $migration$
DECLARE
  d text;
  before_text text := $before$and date_text < hoy;$before$;
  after_text text := $after$and date_text < hoy
 and not public.event_ongoing_after_night_cutoff(date_text,event_time,event_end_time,now());$after$;
BEGIN
  SELECT pg_get_functiondef('public.sweep_stale_events()'::regprocedure) INTO d;
  IF position(before_text IN d)=0 THEN RAISE EXCEPTION 'sweep_stale_events changed; inspect before migration'; END IF;
  EXECUTE replace(d, before_text, after_text);
END
$migration$;

DO $migration$
DECLARE
  d text;
  before_text text := $before$WHEN NEW.date_text < to_char(timezone('America/Santiago', now()) - interval '5 hours', 'YYYY-MM-DD') THEN 'expired'$before$;
  after_text text := $after$WHEN NEW.date_text < to_char(timezone('America/Santiago', now()) - interval '5 hours', 'YYYY-MM-DD')
 AND NOT public.event_ongoing_after_night_cutoff(NEW.date_text,NEW.event_time,NEW.event_end_time,now()) THEN 'expired'$after$;
BEGIN
  SELECT pg_get_functiondef('public.set_event_disposition()'::regprocedure) INTO d;
  IF position(before_text IN d)=0 THEN RAISE EXCEPTION 'set_event_disposition changed; inspect before migration'; END IF;
  EXECUTE replace(d, before_text, after_text);
END
$migration$;

-- Equivalent to the cron's old direct cleanup, with the overnight exception.
CREATE OR REPLACE FUNCTION public.expire_stale_active_events() RETURNS integer
LANGUAGE plpgsql SET search_path = '' AS $body$
DECLARE n integer;
BEGIN
  UPDATE public.events SET is_active=false
  WHERE is_active=true
    AND date_text < to_char(timezone('America/Santiago',now()) - interval '5 hours','YYYY-MM-DD')
    AND NOT public.event_ongoing_after_night_cutoff(date_text,event_time,event_end_time,now());
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n;
END $body$;
REVOKE ALL ON FUNCTION public.expire_stale_active_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_active_events() TO service_role;
