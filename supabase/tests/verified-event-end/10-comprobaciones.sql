-- Comprobaciones de 20261029040057_verified_event_end.sql sobre la base de producción.
-- Las funciones usan now(); para recorrer la noche se reemplaza now() por un reloj de
-- prueba DESPUÉS de verificar el texto exacto de cada función migrada.
\set ON_ERROR_STOP 1
CREATE SCHEMA reloj;
CREATE FUNCTION reloj.ahora() RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT current_setting('reloj.ahora')::timestamptz $$;
GRANT USAGE ON SCHEMA reloj TO anon, authenticated, service_role;
CREATE TABLE public.resultado (prueba text, ok boolean, detalle text);
GRANT ALL ON public.resultado TO anon, authenticated, service_role;
CREATE FUNCTION public.afirmar(p text, cond boolean, det text DEFAULT '') RETURNS void LANGUAGE plpgsql AS $$
BEGIN INSERT INTO public.resultado VALUES (p, coalesce(cond, false), det); END $$;
GRANT EXECUTE ON FUNCTION public.afirmar(text, boolean, text) TO anon, authenticated, service_role;

-- 1. El cuerpo migrado de cada función llama a la excepción con now() (antes del reemplazo).
SELECT afirmar('sweep llama a la excepción', position('and not public.event_ongoing_after_night_cutoff(date_text,event_time,event_end_time,now());' IN pg_get_functiondef('public.sweep_stale_events()'::regprocedure)) > 0);
SELECT afirmar('trigger llama a la excepción', position('AND NOT public.event_ongoing_after_night_cutoff(NEW.date_text,NEW.event_time,NEW.event_end_time,now()) THEN ''expired''' IN pg_get_functiondef('public.set_event_disposition()'::regprocedure)) > 0);
SELECT afirmar('review_item guarda event_end_time', position('event_end_time=CASE WHEN p_fields ? ''event_end_time''' IN pg_get_functiondef('public.review_item(text,text,bigint,text,text,jsonb,text)'::regprocedure)) > 0);
SELECT afirmar('review_item conserva la guarda de corte 05:00 con la excepción de fin verificado',
  position('p_fields->>''date_text'' < to_char(timezone(''America/Santiago'',now()) - interval ''5 hours'',''YYYY-MM-DD'')
 AND NOT public.event_ongoing_after_night_cutoff(' IN pg_get_functiondef('public.review_item(text,text,bigint,text,text,jsonb,text)'::regprocedure)) > 0);
SELECT afirmar('search_path vacío en todas', bool_and(coalesce(array_to_string(proconfig, ','), '') LIKE '%search_path=""%'), string_agg(proname || ':' || coalesce(array_to_string(proconfig, ','), '∅'), ' '))
FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('sweep_stale_events','set_event_disposition','review_item','event_ongoing_after_night_cutoff','expire_stale_active_events');
SELECT afirmar('ninguna SECURITY DEFINER nueva', NOT bool_or(prosecdef)) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('event_ongoing_after_night_cutoff','expire_stale_active_events');

-- 2. Permisos.
SELECT afirmar('anon NO puede vencer eventos', NOT has_function_privilege('anon', 'public.expire_stale_active_events()', 'execute'));
SELECT afirmar('authenticated NO puede vencer eventos', NOT has_function_privilege('authenticated', 'public.expire_stale_active_events()', 'execute'));
SELECT afirmar('service_role sí puede vencer eventos', has_function_privilege('service_role', 'public.expire_stale_active_events()', 'execute'));
SELECT afirmar('anon puede evaluar la excepción (la usa la política)', has_function_privilege('anon', 'public.event_ongoing_after_night_cutoff(text,text,text,timestamptz)', 'execute'));
SELECT afirmar('sweep sigue sólo para service_role', NOT has_function_privilege('anon', 'public.sweep_stale_events()', 'execute'));
SELECT afirmar('política nueva sólo SELECT para anon/authenticated',
  (SELECT cmd = 'SELECT' AND roles = '{anon,authenticated}' FROM pg_policies WHERE policyname = 'Public verified overnight end'));
SELECT afirmar('"Public read" intacta', (SELECT qual FROM pg_policies WHERE policyname = 'Public read') LIKE '%date_text >= to_char((timezone(''America/Santiago''::text, now()) - ''05:00:00''::interval)%');

-- 3. La excepción, con reloj explícito (Chile UTC-3 en oct-2026).
SELECT afirmar('05:30 · fin 06:00 de la noche anterior sigue', public.event_ongoing_after_night_cutoff('2026-10-28','23:00','06:00','2026-10-29 08:30Z'));
SELECT afirmar('05:30 · fin 05:15 ya terminó', NOT public.event_ongoing_after_night_cutoff('2026-10-28','23:00','05:15','2026-10-29 08:30Z'));
SELECT afirmar('05:30 · sin fin no sigue', NOT public.event_ongoing_after_night_cutoff('2026-10-28','23:00',NULL,'2026-10-29 08:30Z'));
SELECT afirmar('05:30 · fin el mismo día (18→19) no sigue', NOT public.event_ongoing_after_night_cutoff('2026-10-28','18:00','19:00','2026-10-29 08:30Z'));
SELECT afirmar('05:30 · dos noches atrás no sigue', NOT public.event_ongoing_after_night_cutoff('2026-10-27','23:00','06:00','2026-10-29 08:30Z'));
SELECT afirmar('04:30 · la excepción no aplica (rige el corte 05:00)', NOT public.event_ongoing_after_night_cutoff('2026-10-28','23:00','06:00','2026-10-29 07:30Z'));
SELECT afirmar('06:00 en punto · ya terminó', NOT public.event_ongoing_after_night_cutoff('2026-10-28','23:00','06:00','2026-10-29 09:00Z'));
SELECT afirmar('hora mal formada no sigue', NOT public.event_ongoing_after_night_cutoff('2026-10-28','23:00','6:00','2026-10-29 08:30Z'));

-- 4. Restricción de la columna.
DO $$ BEGIN
  INSERT INTO public.events(instagram_id,date_text,event_time,event_end_time) VALUES ('x1','2026-10-29',NULL,'06:00');
  PERFORM afirmar('fin sin inicio rechazado', false);
EXCEPTION WHEN check_violation THEN PERFORM afirmar('fin sin inicio rechazado', true); END $$;
DO $$ BEGIN
  INSERT INTO public.events(instagram_id,date_text,event_time,event_end_time) VALUES ('x2','2026-10-29','23:00','23:00');
  PERFORM afirmar('fin igual a inicio rechazado', false);
EXCEPTION WHEN check_violation THEN PERFORM afirmar('fin igual a inicio rechazado', true); END $$;
DO $$ BEGIN
  INSERT INTO public.events(instagram_id,date_text,event_time,event_end_time) VALUES ('x3','2026-10-29','23:00','25:00');
  PERFORM afirmar('fin mal formado rechazado', false);
EXCEPTION WHEN check_violation THEN PERFORM afirmar('fin mal formado rechazado', true); END $$;

-- 5. Reloj de prueba: mismas funciones y políticas, con now() → reloj.ahora().
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.sweep_stale_events()','public.set_event_disposition()','public.expire_stale_active_events()','public.review_item(text,text,bigint,text,text,jsonb,text)'] LOOP
    EXECUTE replace(pg_get_functiondef(f::regprocedure), 'now()', 'reloj.ahora()');
  END LOOP;
END $$;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname, qual FROM pg_policies WHERE tablename = 'events' LOOP
    EXECUTE format('ALTER POLICY %I ON public.events USING (%s)', p.policyname, replace(p.qual, 'now()', 'reloj.ahora()'));
  END LOOP;
END $$;

SET reloj.ahora = '2026-10-29 01:00Z'; -- 22:00 del 28 en Chile: se cargan los eventos de la noche
INSERT INTO public.events(instagram_id,title,date_text,event_time,event_end_time,is_active,moderation_status) VALUES
 ('A-hasta-06','A','2026-10-28','23:00','06:00',true,'approved'),
 ('B-hasta-0515','B','2026-10-28','23:00','05:15',true,'approved'),
 ('C-sin-fin','C','2026-10-28','23:00',NULL,true,'approved'),
 ('D-tarde','D','2026-10-28','18:00','19:00',true,'approved'),
 ('F-manana','F','2026-10-29','20:00',NULL,true,'approved'),
 ('G-revision-hasta-06','G','2026-10-28','23:00','06:00',false,'pending'),
 ('H-revision-sin-fin','H','2026-10-28','23:00',NULL,false,'pending');
-- E: ya vencido antes (inactivo) aunque tenga fin 06:00: jamás revive.
INSERT INTO public.events(instagram_id,title,date_text,event_time,event_end_time,is_active,moderation_status,disposition)
VALUES ('E-ya-vencido','E','2026-10-28','23:00','06:00',false,'approved','expired');

CREATE FUNCTION public.visibles() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(instagram_id, ',' ORDER BY instagram_id), '') FROM public.events $$;
GRANT EXECUTE ON FUNCTION public.visibles() TO anon;

SET reloj.ahora = '2026-10-29 07:30Z'; -- 04:30 Chile: la noche del 28 sigue entera
SET ROLE anon;
SELECT afirmar('04:30 · anon ve toda la noche', public.visibles() = 'A-hasta-06,B-hasta-0515,C-sin-fin,D-tarde,F-manana', public.visibles());
RESET ROLE;
SELECT afirmar('04:30 · el barrido no vence nada de la noche', public.sweep_stale_events() = 0);

SET reloj.ahora = '2026-10-29 08:30Z'; -- 05:30 Chile
SET ROLE anon;
SELECT afirmar('05:30 · anon ve sólo lo que sigue (A) y lo de hoy', public.visibles() = 'A-hasta-06,F-manana', public.visibles());
RESET ROLE;
SELECT afirmar('05:30 · cron vence B, C y D', public.expire_stale_active_events() = 3);
SELECT afirmar('05:30 · A sigue activo', (SELECT is_active FROM public.events WHERE instagram_id = 'A-hasta-06'));
SELECT afirmar('05:30 · E no revive', NOT (SELECT is_active FROM public.events WHERE instagram_id = 'E-ya-vencido'));
SELECT afirmar('05:30 · barrido no toca A', public.sweep_stale_events() >= 0 AND (SELECT is_active AND disposition = 'public' FROM public.events WHERE instagram_id = 'A-hasta-06'));
SELECT afirmar('05:30 · barrido no vence G (en revisión, aún en curso)', (SELECT disposition = 'review' FROM public.events WHERE instagram_id = 'G-revision-hasta-06'),
  (SELECT disposition FROM public.events WHERE instagram_id = 'G-revision-hasta-06'));
SELECT afirmar('05:30 · barrido vence H (en revisión, sin fin)', (SELECT disposition = 'expired' FROM public.events WHERE instagram_id = 'H-revision-sin-fin'));
-- Trigger: recalcular la disposición de G (sigue en curso) no la vence; de una sin fin, sí.
UPDATE public.events SET is_active = false WHERE instagram_id = 'G-revision-hasta-06';
UPDATE public.events SET moderation_status = 'rejected' WHERE instagram_id = 'G-revision-hasta-06';
UPDATE public.events SET moderation_status = 'pending', disposition = NULL WHERE instagram_id = 'G-revision-hasta-06';
SELECT afirmar('05:30 · trigger deja G en revisión', (SELECT disposition FROM public.events WHERE instagram_id = 'G-revision-hasta-06') = 'review',
  (SELECT disposition FROM public.events WHERE instagram_id = 'G-revision-hasta-06'));
INSERT INTO public.events(instagram_id,title,date_text,event_time,is_active,moderation_status) VALUES ('I-nuevo-sin-fin','I','2026-10-28','23:00',false,'pending');
SELECT afirmar('05:30 · trigger vence una fila nueva de anoche sin fin', (SELECT disposition FROM public.events WHERE instagram_id = 'I-nuevo-sin-fin') = 'expired');

-- review_item: guarda, conserva si se omite y borra con "".
DO $$
DECLARE r bigint; v_id bigint;
  campos jsonb := '{"title":"Fiesta F","date_text":"2026-10-29","event_time":"23:00","instagram_url":"https://instagram.com/p/x","venue":"V","city":"Valparaíso"}';
BEGIN
  SELECT e.id, e.revision INTO v_id, r FROM public.events e WHERE instagram_id = 'F-manana';
  PERFORM public.review_item('event', v_id::text, r, 'save', 'agente: fin verificado en fuente', campos || '{"event_end_time":"04:00"}', 'agente-prueba');
  PERFORM afirmar('review_item guarda el fin', (SELECT event_end_time FROM public.events e WHERE e.id = v_id) = '04:00');
  SELECT revision INTO r FROM public.events e WHERE e.id = v_id;
  PERFORM public.review_item('event', v_id::text, r, 'save', 'agente: corrige otro campo', campos, 'agente-prueba');
  PERFORM afirmar('review_item sin la clave conserva el fin (clientes antiguos)', (SELECT event_end_time FROM public.events e WHERE e.id = v_id) = '04:00');
  SELECT revision INTO r FROM public.events e WHERE e.id = v_id;
  PERFORM public.review_item('event', v_id::text, r, 'save', 'agente: fin no confirmado', campos || '{"event_end_time":""}', 'agente-prueba');
  PERFORM afirmar('review_item con "" lo borra', (SELECT event_end_time FROM public.events e WHERE e.id = v_id) IS NULL);
END $$;

-- review_item a las 05:30: aprobar un evento de anoche que sigue en curso sí; sin fin o ya terminado, no.
INSERT INTO public.events(instagram_id,title,date_text,event_time,is_active,moderation_status) VALUES ('J-aprobar','J','2026-10-29','23:00',false,'pending');
DO $$
DECLARE r bigint; v_id bigint; ok boolean;
  campos jsonb := '{"title":"Fiesta J","date_text":"2026-10-28","event_time":"23:00","instagram_url":"https://instagram.com/p/j","venue":"V","city":"Valparaíso"}';
BEGIN
  SELECT e.id, e.revision INTO v_id, r FROM public.events e WHERE instagram_id = 'J-aprobar';
  BEGIN
    PERFORM public.review_item('event', v_id::text, r, 'approve', 'agente: anoche sin fin verificado', campos, 'agente-prueba');
    ok := false;
  EXCEPTION WHEN raise_exception THEN ok := true; END;
  PERFORM afirmar('05:30 · review_item rechaza aprobar anoche sin fin', ok);
  BEGIN
    PERFORM public.review_item('event', v_id::text, r, 'approve', 'agente: anoche, fin 05:15 ya pasó', campos || '{"event_end_time":"05:15"}', 'agente-prueba');
    ok := false;
  EXCEPTION WHEN raise_exception THEN ok := true; END;
  PERFORM afirmar('05:30 · review_item rechaza anoche con fin ya pasado', ok);
  PERFORM public.review_item('event', v_id::text, r, 'approve', 'agente: anoche, fin 06:00 verificado', campos || '{"event_end_time":"06:00"}', 'agente-prueba');
  PERFORM afirmar('05:30 · review_item aprueba anoche con fin verificado aún futuro',
    (SELECT is_active AND moderation_status = 'approved' AND date_text = '2026-10-28' AND event_end_time = '06:00' FROM public.events e WHERE e.id = v_id));
  -- Guardar sin la clave usa el fin ya guardado para la guarda (clientes antiguos).
  SELECT revision INTO r FROM public.events e WHERE e.id = v_id;
  PERFORM public.review_item('event', v_id::text, r, 'save', 'agente: corrige el título', campos || '{"title":"Fiesta J bis"}', 'agente-prueba');
  PERFORM afirmar('05:30 · guardar sin la clave usa el fin guardado', (SELECT title = 'Fiesta J bis' AND event_end_time = '06:00' FROM public.events e WHERE e.id = v_id));
  BEGIN
    SELECT revision INTO r FROM public.events e WHERE e.id = v_id;
    PERFORM public.review_item('event', v_id::text, r, 'save', 'agente: fecha antigua', campos || '{"date_text":"2026-10-27","event_end_time":"06:00"}', 'agente-prueba');
    ok := false;
  EXCEPTION WHEN raise_exception THEN ok := true; END;
  PERFORM afirmar('05:30 · review_item rechaza dos noches atrás aunque tenga fin', ok);
END $$;
SET ROLE anon;
SELECT afirmar('05:30 · J aprobado se ve', position('J-aprobar' IN public.visibles()) > 0, public.visibles());
RESET ROLE;

SET reloj.ahora = '2026-10-29 09:30Z'; -- 06:30 Chile
-- Ya terminó: ni siquiera con fin se puede aprobar.
DO $$
DECLARE r bigint; v_id bigint; ok boolean;
BEGIN
  INSERT INTO public.events(instagram_id,title,date_text,event_time,is_active,moderation_status) VALUES ('K-tarde','K','2026-10-29','23:00',false,'pending') RETURNING id, revision INTO v_id, r;
  BEGIN
    PERFORM public.review_item('event', v_id::text, r, 'approve', 'agente: anoche ya terminado',
      '{"title":"Fiesta K","date_text":"2026-10-28","event_time":"23:00","event_end_time":"06:00","instagram_url":"https://instagram.com/p/k","venue":"V","city":"Valparaíso"}', 'agente-prueba');
    ok := false;
  EXCEPTION WHEN raise_exception THEN ok := true; END;
  PERFORM afirmar('06:30 · review_item rechaza un evento de anoche ya terminado', ok);
END $$;
SET ROLE anon;
SELECT afirmar('06:30 · A y J ya no se ven', public.visibles() = 'F-manana', public.visibles());
RESET ROLE;
SELECT afirmar('06:30 · cron vence A y J', public.expire_stale_active_events() = 2);
SELECT afirmar('06:30 · ningún vencido revivió', NOT EXISTS (SELECT 1 FROM public.events WHERE date_text = '2026-10-28' AND is_active));

SELECT CASE WHEN ok THEN 'ok   ' ELSE 'FALLA' END, prueba, detalle FROM public.resultado ORDER BY ok, prueba;
SELECT count(*) FILTER (WHERE ok) AS ok, count(*) FILTER (WHERE NOT ok) AS fallas FROM public.resultado;
