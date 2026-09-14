BEGIN;
-- Venue and zone discovery need their own aggregate counters.
ALTER TABLE public.metrics_daily DROP CONSTRAINT metrics_daily_name_check;
ALTER TABLE public.metrics_daily ADD CONSTRAINT metrics_daily_name_check
CHECK (name IN ('page_view','event_open','filter','share','source','directions','submission_start','submission_complete','report','venue_open','zone_open'));
COMMIT;
