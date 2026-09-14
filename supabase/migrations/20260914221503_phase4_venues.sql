BEGIN;
-- A place can exist in Carreteando with no event scheduled tonight.
-- Events keep their free-text venue string; venue_id links them when known.
CREATE TABLE public.venues (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  city text NOT NULL,
  zone text,
  address text,
  venue_type text NOT NULL DEFAULT 'bar',
  tags text[] NOT NULL DEFAULT '{}',
  description_short text,
  official_url text,
  instagram_url text,
  calendar_url text,
  image_url text,
  source_type text NOT NULL,
  source_url text NOT NULL,
  moderation_status text NOT NULL DEFAULT 'pending',
  is_active boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz,
  reviewed_at timestamptz,
  revision bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.events ADD COLUMN venue_id bigint REFERENCES public.venues(id) ON DELETE SET NULL;
CREATE INDEX events_by_venue ON public.events(venue_id) WHERE venue_id IS NOT NULL;
CREATE INDEX venues_public ON public.venues(city, zone) WHERE is_active AND moderation_status='approved';

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
-- Same contract as events: nothing uncertain is publicly readable.
CREATE POLICY "Public read" ON public.venues FOR SELECT TO anon, authenticated
USING (is_active=true AND moderation_status='approved');
REVOKE ALL ON public.venues FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.venues TO anon,authenticated;
REVOKE ALL ON SEQUENCE public.venues_id_seq FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.venues TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.venues_id_seq TO service_role;

-- Review a venue in one transaction, with the same revision guard and audit
-- trail that events already use.
CREATE FUNCTION public.review_venue(p_id text,p_revision bigint,p_action text,p_note text,p_fields jsonb)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_row public.venues; new_row public.venues;
BEGIN
 IF p_action NOT IN ('approve','save','reject','withdraw') OR length(p_note)<10 OR length(p_note)>1000
   THEN RAISE EXCEPTION 'Invalid review'; END IF;
 SELECT * INTO old_row FROM public.venues WHERE id=p_id::bigint FOR UPDATE;
 IF NOT FOUND OR old_row.revision<>p_revision THEN RETURN 'conflict'; END IF;
 IF p_action IN ('approve','save') THEN
  IF length(coalesce(p_fields->>'name',''))<2 OR length(coalesce(p_fields->>'city',''))<3
    OR length(coalesce(p_fields->>'source_url',''))<8 THEN RAISE EXCEPTION 'Invalid venue'; END IF;
  UPDATE public.venues SET name=p_fields->>'name',city=p_fields->>'city',zone=nullif(p_fields->>'zone',''),
   address=nullif(p_fields->>'address',''),venue_type=coalesce(nullif(p_fields->>'venue_type',''),'bar'),
   description_short=nullif(p_fields->>'description_short',''),official_url=nullif(p_fields->>'official_url',''),
   instagram_url=nullif(p_fields->>'instagram_url',''),calendar_url=nullif(p_fields->>'calendar_url',''),
   image_url=nullif(p_fields->>'image_url',''),source_url=p_fields->>'source_url',
   last_verified_at=now(),reviewed_at=now(),revision=revision+1,
   is_active=CASE WHEN p_action='approve' THEN true ELSE is_active END,
   moderation_status=CASE WHEN p_action='approve' THEN 'approved' ELSE moderation_status END
  WHERE id=old_row.id RETURNING * INTO new_row;
 ELSE
  UPDATE public.venues SET is_active=false,
   moderation_status=CASE WHEN p_action='reject' THEN 'rejected' ELSE moderation_status END,
   reviewed_at=now(),revision=revision+1
  WHERE id=old_row.id RETURNING * INTO new_row;
 END IF;
 INSERT INTO public.review_audit(target,action,note,previous,current)
 VALUES('venue:'||p_id,p_action,p_note,to_jsonb(old_row),to_jsonb(new_row));
 RETURN 'saved';
END $$;
REVOKE ALL ON FUNCTION public.review_venue(text,bigint,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_venue(text,bigint,text,text,jsonb) TO service_role;
COMMIT;
