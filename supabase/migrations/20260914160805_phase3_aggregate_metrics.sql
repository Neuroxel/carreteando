BEGIN;
CREATE TABLE public.metrics_daily (day date NOT NULL, name text NOT NULL CHECK(name IN ('page_view','event_open','filter','share','source','directions','submission_start','submission_complete','report')), count bigint NOT NULL DEFAULT 0, PRIMARY KEY(day,name));
ALTER TABLE public.metrics_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.metrics_daily FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.metrics_daily TO service_role;
CREATE FUNCTION public.count_metric(p_name text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 DELETE FROM public.metrics_daily WHERE day < (timezone('America/Santiago',now()))::date-90;
 INSERT INTO public.metrics_daily(day,name,count) VALUES((timezone('America/Santiago',now()))::date,p_name,1) ON CONFLICT(day,name) DO UPDATE SET count=public.metrics_daily.count+1;
END $$;
REVOKE ALL ON FUNCTION public.count_metric(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.count_metric(text) TO service_role;
COMMIT;
