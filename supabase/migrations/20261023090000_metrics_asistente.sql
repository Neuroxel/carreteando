-- Métricas agregadas (sin datos personales ni ubicación). La restricción
-- quedó atrás de lib/metrics.ts (map_open, search, etc. se rechazaban).
-- Ahora acepta exactamente la lista METRICS, incluidas las del asistente.
BEGIN;
ALTER TABLE public.metrics_daily DROP CONSTRAINT IF EXISTS metrics_daily_name_check;
ALTER TABLE public.metrics_daily ADD CONSTRAINT metrics_daily_name_check
CHECK (name IN ('page_view','event_open','filter','share','source','directions','submission_start','submission_complete','report','venue_open','zone_open','live_report','map_open','search','social_click','marker_open','instagram_click','zero_result_search','venue_proposal','intent_selected','view_all'));
COMMIT;
