BEGIN;
ALTER TABLE public.events ADD COLUMN revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.community_inbox ADD COLUMN revision bigint NOT NULL DEFAULT 0;
CREATE TABLE public.operation_limits (scope text NOT NULL, key text NOT NULL, bucket_start timestamptz NOT NULL, hits integer NOT NULL, PRIMARY KEY(scope,key,bucket_start));
CREATE TABLE public.review_audit (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), target text NOT NULL, action text NOT NULL, note text NOT NULL, previous jsonb, current jsonb);
ALTER TABLE public.operation_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operation_limits, public.review_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.operation_limits, public.review_audit TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.review_audit_id_seq TO service_role;
CREATE FUNCTION public.operation_allowed(p_scope text,p_key text,p_limit integer,p_global integer) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE w timestamptz := date_bin(interval '15 minutes',now(),'2026-01-01'::timestamptz); n integer; g integer;
BEGIN
 PERFORM pg_advisory_xact_lock(83620260915);
 DELETE FROM public.operation_limits WHERE bucket_start < now()-interval '2 days';
 INSERT INTO public.operation_limits VALUES(p_scope,p_key,w,1) ON CONFLICT(scope,key,bucket_start) DO UPDATE SET hits=public.operation_limits.hits+1 RETURNING hits INTO n;
 SELECT coalesce(sum(hits),0) INTO g FROM public.operation_limits WHERE scope=p_scope AND bucket_start=w;
 RETURN n<=p_limit AND g<=p_global;
END $$;
REVOKE ALL ON FUNCTION public.operation_allowed(text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.operation_allowed(text,text,integer,integer) TO service_role;
-- One transaction: compare revision, edit/review, link community item, append audit.
CREATE FUNCTION public.review_item(p_kind text,p_id text,p_revision bigint,p_action text,p_note text,p_fields jsonb) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_event public.events; old_item public.community_inbox; result_row public.events; item_status text;
BEGIN
 IF p_action NOT IN ('approve','save','reject','withdraw','resolve') OR length(p_note)<10 OR length(p_note)>1000 THEN RAISE EXCEPTION 'Invalid review'; END IF;
 IF p_kind='event' THEN
  SELECT * INTO old_event FROM public.events WHERE id=p_id::bigint FOR UPDATE;
  IF NOT FOUND OR old_event.revision<>p_revision THEN RETURN 'conflict'; END IF;
 ELSIF p_kind='inbox' THEN
  SELECT * INTO old_item FROM public.community_inbox WHERE id=p_id::uuid FOR UPDATE;
  IF NOT FOUND OR old_item.revision<>p_revision OR old_item.status<>'pending' THEN RETURN 'conflict'; END IF;
  IF old_item.kind='report' AND p_action NOT IN ('resolve','reject') THEN RAISE EXCEPTION 'Report needs resolution'; END IF;
  IF old_item.kind='submission' AND p_action NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Invalid submission action'; END IF;
 ELSE RAISE EXCEPTION 'Invalid kind'; END IF;
 IF p_action IN ('approve','save') THEN
  IF p_fields->>'date_text' < to_char(timezone('America/Santiago',now()),'YYYY-MM-DD') OR p_fields->>'date_text' IS NULL
    OR length(coalesce(p_fields->>'title',''))<4 OR length(coalesce(p_fields->>'instagram_url',''))<8 THEN RAISE EXCEPTION 'Invalid event'; END IF;
  IF p_kind='inbox' THEN
   INSERT INTO public.events(instagram_id,title,is_active,moderation_status,source) VALUES('community-'||p_id,p_fields->>'title',false,'pending','manual') RETURNING * INTO old_event;
  END IF;
  UPDATE public.events SET title=p_fields->>'title',description=p_fields->>'description',date_text=p_fields->>'date_text',event_time=p_fields->>'event_time',venue=p_fields->>'venue',city=p_fields->>'city',address=p_fields->>'address',location=p_fields->>'venue'||' · '||(p_fields->>'city'),price_clp=(p_fields->>'price_clp')::integer,price_text=p_fields->>'price_text',category=p_fields->>'category',instagram_url=p_fields->>'instagram_url',image_url=p_fields->>'image_url',username=p_fields->>'username',event_key=p_fields->>'event_key',last_verified_at=now(),reviewed_at=now(),revision=revision+1,
   is_active=CASE WHEN p_action='approve' THEN true ELSE is_active END,
   moderation_status=CASE WHEN p_action='approve' THEN 'approved' ELSE moderation_status END
  WHERE id=old_event.id RETURNING * INTO result_row;
 ELSIF p_kind='event' AND p_action IN ('reject','withdraw') THEN
  UPDATE public.events SET is_active=false,moderation_status=CASE WHEN p_action='reject' THEN 'rejected' ELSE moderation_status END,reviewed_at=now(),revision=revision+1 WHERE id=old_event.id RETURNING * INTO result_row;
 ELSIF p_kind='event' THEN RAISE EXCEPTION 'Invalid event action';
 END IF;
 IF p_kind='inbox' THEN
  item_status := CASE WHEN p_action='reject' THEN 'rejected' ELSE 'accepted' END;
  UPDATE public.community_inbox SET status=item_status,reviewed_at=now(),review_note=p_note,event_id=coalesce(result_row.id,event_id),revision=revision+1 WHERE id=old_item.id;
 END IF;
 INSERT INTO public.review_audit(target,action,note,previous,current) VALUES(p_kind||':'||p_id,p_action,p_note,CASE WHEN p_kind='event' THEN to_jsonb(old_event) ELSE to_jsonb(old_item) END,CASE WHEN result_row.id IS NOT NULL THEN to_jsonb(result_row) ELSE jsonb_build_object('status',item_status) END);
 RETURN 'saved';
END $$;
REVOKE ALL ON FUNCTION public.review_item(text,text,bigint,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_item(text,text,bigint,text,text,jsonb) TO service_role;
COMMIT;
