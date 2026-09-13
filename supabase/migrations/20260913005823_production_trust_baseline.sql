-- Additive migration. Historical source rows remain intact and quarantined.
BEGIN;
ALTER TABLE public.events
  ADD COLUMN moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected')),
  ADD COLUMN event_key text,
  ADD COLUMN source_published_at timestamptz,
  ADD COLUMN last_verified_at timestamptz,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN city text,
  ADD COLUMN venue text,
  ADD COLUMN address text,
  ADD COLUMN event_time text,
  ADD COLUMN price_clp integer CHECK (price_clp BETWEEN 0 AND 500000),
  ADD COLUMN price_text text,
  ADD COLUMN category text,
  ADD COLUMN organizer_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN ingestion_run_id uuid;
ALTER TABLE public.events ALTER COLUMN is_active SET DEFAULT false;
-- No legacy row gets automatic approval; no historical row is deleted.
UPDATE public.events SET is_active=false WHERE is_active=true;
CREATE UNIQUE INDEX events_canonical_key ON public.events(event_key) WHERE event_key IS NOT NULL;
CREATE INDEX events_public_dates ON public.events(date_text) WHERE is_active AND moderation_status='approved';
DROP POLICY IF EXISTS "Public read" ON public.events;
CREATE POLICY "Public read" ON public.events FOR SELECT TO anon, authenticated
USING (is_active=true AND moderation_status='approved' AND date_text >= to_char(timezone('America/Santiago',now()),'YYYY-MM-DD'));
REVOKE ALL ON public.events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.events TO anon,authenticated;
REVOKE ALL ON SEQUENCE public.events_id_seq FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE VIEW public.recent_events WITH (security_invoker=true) AS
SELECT id,instagram_id,title,description,date_text,location,image_url,instagram_url,username,likes,scraped_at,source,is_active
FROM public.events WHERE is_active=true AND moderation_status='approved'
AND date_text>=to_char(timezone('America/Santiago',now()),'YYYY-MM-DD')
AND scraped_at>now()-interval '14 days' ORDER BY date_text,scraped_at DESC;
REVOKE ALL ON public.recent_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.recent_events TO anon,authenticated;

CREATE TABLE public.community_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK(kind IN ('submission','report')),
  payload jsonb NOT NULL CHECK(octet_length(payload::text)<=16000),
  fingerprint text NOT NULL CHECK(length(fingerprint)=64),
  request_hash text NOT NULL CHECK(length(request_hash)=64),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  review_note text,
  event_id bigint REFERENCES public.events(id)
);
ALTER TABLE public.community_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_inbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.community_inbox TO service_role;
CREATE INDEX inbox_rate ON public.community_inbox(request_hash,created_at DESC);
CREATE INDEX inbox_fingerprint ON public.community_inbox(fingerprint,created_at DESC);
CREATE INDEX inbox_created ON public.community_inbox(created_at DESC);

-- Service-only RPC. Global lock makes quota + duplicate check + insert atomic across instances.
CREATE FUNCTION public.receive_community_item(p_kind text,p_payload jsonb,p_fingerprint text,p_request_hash text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(83620260913);
  IF (SELECT count(*) FROM public.community_inbox WHERE created_at>now()-interval '1 day')>=100
    OR (SELECT count(*) FROM public.community_inbox WHERE request_hash=p_request_hash AND created_at>now()-interval '1 hour')>=3 THEN
    RETURN 'rate_limited';
  END IF;
  IF EXISTS(SELECT 1 FROM public.community_inbox WHERE fingerprint=p_fingerprint AND created_at>now()-interval '7 days') THEN RETURN 'duplicate'; END IF;
  INSERT INTO public.community_inbox(kind,payload,fingerprint,request_hash) VALUES(p_kind,p_payload,p_fingerprint,p_request_hash);
  RETURN 'received';
END;
$$;
REVOKE ALL ON FUNCTION public.receive_community_item(text,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.receive_community_item(text,jsonb,text,text) TO service_role;

CREATE TABLE public.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK(status IN ('running','succeeded','failed')),
  apify_run_id text,
  dataset_id text,
  cost_usd numeric,
  metrics jsonb NOT NULL DEFAULT '{}',
  error_code text
);
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ingestion_runs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ingestion_runs TO service_role;
CREATE INDEX ingestion_started ON public.ingestion_runs(started_at DESC);
CREATE TABLE public.ingestion_posts (
  post_id text PRIMARY KEY,
  source_account text NOT NULL,
  source_published_at timestamptz,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  caption text NOT NULL,
  source_url text NOT NULL,
  outcome text NOT NULL,
  run_id uuid NOT NULL REFERENCES public.ingestion_runs(id)
);
ALTER TABLE public.ingestion_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ingestion_posts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ingestion_posts TO service_role;
-- Prevent overlapping runs and repeated paid retries (6h cooldown, including failure).
CREATE FUNCTION public.claim_ingestion_run() RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE new_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(83620260914);
 IF EXISTS(SELECT 1 FROM public.ingestion_runs WHERE started_at>now()-interval '6 hours') THEN RETURN NULL; END IF;
 INSERT INTO public.ingestion_runs(status) VALUES('running') RETURNING id INTO new_id;
 RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_ingestion_run() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ingestion_run() TO service_role;
COMMIT;
