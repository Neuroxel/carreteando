BEGIN;
INSERT INTO public.events(instagram_id,title,date_text,is_active,moderation_status) VALUES
('test-rls-approved','RLS test',to_char(timezone('America/Santiago',now()),'YYYY-MM-DD'),true,'approved'),
('test-rls-pending','RLS test',to_char(timezone('America/Santiago',now()),'YYYY-MM-DD'),true,'pending'),
('test-rls-expired','RLS test','2020-01-01',true,'approved');
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.events WHERE instagram_id LIKE 'test-rls-%')<>1 THEN RAISE EXCEPTION 'anon SELECT boundary failed'; END IF;
 IF (SELECT count(*) FROM public.recent_events WHERE instagram_id LIKE 'test-rls-%')<>1 THEN RAISE EXCEPTION 'view bypass'; END IF;
 IF has_table_privilege('anon','public.events','INSERT,UPDATE,DELETE') OR has_table_privilege('anon','public.community_inbox','SELECT,INSERT') OR has_function_privilege('anon','public.receive_community_item(text,jsonb,text,text)','EXECUTE') THEN RAISE EXCEPTION 'public privilege leak'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.events WHERE instagram_id LIKE 'test-rls-%')<>1 THEN RAISE EXCEPTION 'authenticated SELECT boundary failed'; END IF;
 IF has_table_privilege('authenticated','public.events','INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated','public.ingestion_posts','SELECT') OR has_function_privilege('authenticated','public.claim_ingestion_run()','EXECUTE') THEN RAISE EXCEPTION 'authenticated privilege leak'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 IF public.receive_community_item('submission','{}',repeat('a',64),repeat('a',64))<>'received' THEN RAISE EXCEPTION 'receive failed'; END IF;
 IF public.receive_community_item('submission','{}',repeat('a',64),repeat('a',64))<>'duplicate' THEN RAISE EXCEPTION 'dedupe failed'; END IF;
 PERFORM public.receive_community_item('submission','{}',repeat('b',64),repeat('a',64));
 PERFORM public.receive_community_item('submission','{}',repeat('c',64),repeat('a',64));
 IF public.receive_community_item('submission','{}',repeat('d',64),repeat('a',64))<>'rate_limited' THEN RAISE EXCEPTION 'quota failed'; END IF;
 IF public.claim_ingestion_run() IS NULL THEN RAISE EXCEPTION 'claim failed'; END IF;
 IF public.claim_ingestion_run() IS NOT NULL THEN RAISE EXCEPTION 'cooldown failed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: RLS, view, anon/authenticated privileges, pending inbox, duplicate, quota, run cooldown; all test writes rolled back' AS result;
