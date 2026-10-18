-- La noche de un día dura hasta las 05:00 de Chile: el sábado a las 02:00 sigue
-- siendo "hoy sábado". La lectura pública deja ver los eventos de la fecha de la
-- noche (misma regla que fechaDeLaNoche() en lib/event-extraction.ts).
-- Solo cambia el corte de la fecha; el resto de la política queda igual.
DROP POLICY IF EXISTS "Public read" ON public.events;
CREATE POLICY "Public read" ON public.events FOR SELECT TO anon, authenticated
USING (
  is_active = true
  AND moderation_status = 'approved'
  AND date_text >= to_char(timezone('America/Santiago', now()) - interval '5 hours', 'YYYY-MM-DD')
);

CREATE OR REPLACE VIEW public.recent_events WITH (security_invoker = true) AS
SELECT id, instagram_id, title, description, date_text, location, image_url, instagram_url, username, likes, scraped_at, source, is_active
FROM public.events
WHERE is_active = true AND moderation_status = 'approved'
  AND date_text >= to_char(timezone('America/Santiago', now()) - interval '5 hours', 'YYYY-MM-DD')
  AND scraped_at > now() - interval '14 days'
ORDER BY date_text, scraped_at DESC;
