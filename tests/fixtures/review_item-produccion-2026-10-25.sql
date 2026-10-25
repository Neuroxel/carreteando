CREATE OR REPLACE FUNCTION public.review_item(p_kind text, p_id text, p_revision bigint, p_action text, p_note text, p_fields jsonb, p_actor text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE old_event public.events; old_item public.community_inbox; result_row public.events; item_status text;
BEGIN
 IF p_action NOT IN ('approve','save','reject','withdraw','resolve') OR length(p_note)<10 OR length(p_note)>1000 THEN RAISE EXCEPTION 'Invalid review'; END IF;
 IF p_kind='event' THEN
 SELECT * INTO old_event FROM public.events WHERE id=p_id::bigint FOR UPDATE;
 IF NOT FOUND OR old_event.revision<>p_revision THEN RETURN 'conflict'; END IF;
 ELSIF p_kind='inbox' THEN
 SELECT * INTO old_item FROM public.community_inbox WHERE id=p_id::uuid FOR UPDATE;
 IF NOT FOUND OR old_item.revision<>p_revision OR old_item.status<>'pending' THEN RETURN 'conflict'; END IF;
 IF old_item.kind IN ('report','venue') AND p_action NOT IN ('resolve','reject') THEN RAISE EXCEPTION 'Report needs resolution'; END IF;
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
 INSERT INTO public.review_audit(target,action,note,previous,current,actor)
 VALUES(p_kind||':'||p_id,p_action,p_note,
 CASE WHEN p_kind='event' THEN to_jsonb(old_event) ELSE to_jsonb(old_item) END,
 CASE WHEN result_row.id IS NOT NULL THEN to_jsonb(result_row) ELSE jsonb_build_object('status',item_status) END,
 coalesce(nullif(p_actor,''),'desconocido'));
 RETURN 'saved';
END $function$
