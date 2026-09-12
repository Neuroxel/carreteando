-- Tabla principal de eventos
CREATE TABLE IF NOT EXISTS events (
  id              BIGSERIAL PRIMARY KEY,
  instagram_id    TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  date_text       TEXT,
  location        TEXT DEFAULT ''V Region'',
  image_url       TEXT,
  instagram_url   TEXT,
  username        TEXT,
  likes           INTEGER DEFAULT 0,
  scraped_at      TIMESTAMPTZ DEFAULT NOW(),
  source          TEXT DEFAULT ''instagram_hashtag'',
  is_active       BOOLEAN DEFAULT TRUE
);

-- Indices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location);
CREATE INDEX IF NOT EXISTS idx_events_scraped_at ON events(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_likes ON events(likes DESC);

-- RLS: lectura pública, escritura solo service role
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON events
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Service insert" ON events
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Service upsert" ON events
  FOR UPDATE USING (TRUE);

-- Vista útil: eventos recientes ordenados por likes
CREATE OR REPLACE VIEW recent_events AS
  SELECT * FROM events
  WHERE is_active = TRUE
    AND scraped_at > NOW() - INTERVAL ''7 days''
  ORDER BY likes DESC, scraped_at DESC;
