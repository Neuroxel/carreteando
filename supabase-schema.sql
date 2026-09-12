-- Carretes V Región — esquema MVP
-- Ejecutar este archivo/migración en Supabase antes de publicar el MVP.

CREATE TABLE IF NOT EXISTS events (
  id              BIGSERIAL PRIMARY KEY,
  instagram_id    TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  date_text       TEXT,
  location        TEXT DEFAULT 'V Region',
  image_url       TEXT,
  instagram_url   TEXT,
  username        TEXT,
  likes           INTEGER DEFAULT 0,
  scraped_at      TIMESTAMPTZ DEFAULT NOW(),
  source          TEXT DEFAULT 'instagram_hashtag',
  is_active       BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_events_location ON events(location);
CREATE INDEX IF NOT EXISTS idx_events_scraped_at ON events(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_likes ON events(likes DESC);
CREATE INDEX IF NOT EXISTS idx_events_date_text ON events(date_text);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Elimina políticas antiguas que permitían escrituras públicas.
DROP POLICY IF EXISTS "Public read" ON events;
DROP POLICY IF EXISTS "Service insert" ON events;
DROP POLICY IF EXISTS "Service upsert" ON events;

-- La aplicación pública sólo puede leer eventos activos.
CREATE POLICY "Public read" ON events
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

-- Defensa adicional: las escrituras públicas quedan revocadas.
-- El service_role de Supabase opera en endpoints server-side y bypassa RLS.
REVOKE INSERT, UPDATE, DELETE ON TABLE events FROM anon, authenticated;
GRANT SELECT ON TABLE events TO anon, authenticated;

CREATE OR REPLACE VIEW recent_events AS
  SELECT * FROM events
  WHERE is_active = TRUE
    AND scraped_at > NOW() - INTERVAL '14 days'
  ORDER BY date_text ASC NULLS LAST, scraped_at DESC;
