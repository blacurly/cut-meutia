BEGIN;

CREATE OR REPLACE FUNCTION public.app_system_close_unconfirmed_complaints(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.complaints%ROWTYPE; v_count integer:=0; v_request text:='complaint-timeout:'||gen_random_uuid()::text;
BEGIN
  -- service_role invokes through the API; Supabase Cron runs this SQL as the
  -- database owner (no JWT claim). Ordinary authenticated/anon callers fail.
  IF auth.role() IS NOT NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_expire_limit'; END IF;
  FOR v_row IN SELECT * FROM public.complaints WHERE status='waiting_for_confirmation'
    AND confirmation_due_at<=now() ORDER BY confirmation_due_at LIMIT p_limit FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.complaints SET status='closed',closed_at=now(),closure_reason='Auto-closed after 72-hour confirmation period',
      updated_at=now(),version=version+1 WHERE id=v_row.id;
    INSERT INTO public.complaint_status_logs(complaint_id,from_status,to_status,actor_type,reason)
    VALUES(v_row.id,'waiting_for_confirmation','closed','system','Auto-closed after 72-hour confirmation period');
    PERFORM public.app_internal_audit('complaint.auto_close','complaint',v_row.id,v_row.daycare_id,
      'No complainant response within 72 hours',jsonb_build_object('status',v_row.status),jsonb_build_object('status','closed'),v_request);
    v_count:=v_count+1;
  END LOOP;
  RETURN v_count;
END;
$function$;
REVOKE ALL ON FUNCTION public.app_system_close_unconfirmed_complaints(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.app_system_close_unconfirmed_complaints(integer) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

SELECT cron.schedule('ayomi-close-unconfirmed-complaints','*/15 * * * *',
  'SELECT public.app_system_close_unconfirmed_complaints(100);');

COMMIT;
