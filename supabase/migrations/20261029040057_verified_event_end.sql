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
