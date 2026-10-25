-- La noche dura hasta las 05:00 de Chile (misma regla que fechaDeLaNoche() en
-- lib/event-extraction.ts y que la política "Public read" de 20261018090000).
-- El barrido de vencidos y la disposición automática todavía cortaban a
-- medianoche: el domingo 25-oct a las 04:15 UTC (01:15 en Chile) vencieron
-- eventos del sábado 24 que seguían siendo "esta noche".
--
-- Registra las dos funciones tal como quedaron corregidas en producción el
-- 25-oct. No incluye la recuperación de filas (operación auditada aparte) ni
-- repite la migración 20261018090000.

CREATE OR REPLACE FUNCTION public.sweep_stale_events()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 hoy text := to_char(timezone('America/Santiago', now()) - interval '5 hours', 'YYYY-MM-DD');
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
end $function$
;
CREATE OR REPLACE FUNCTION public.set_event_disposition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
 WHEN NEW.date_text < to_char(timezone('America/Santiago', now()) - interval '5 hours', 'YYYY-MM-DD') THEN 'expired'
 ELSE 'review' END;
 NEW.disposition_at := now();
 IF NEW.disposition = 'review' AND NEW.disposition_note IS NULL THEN
 NEW.disposition_note := 'Encontrado automáticamente, a la espera de revisión.';
 END IF;
 END IF;
 RETURN NEW;
END $function$
;
