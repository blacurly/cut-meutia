DO $audit$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.app_save_daily_activity(uuid,uuid,date,text,text,text,timestamp with time zone,jsonb,text,boolean,text,text,text)',
    'public.app_acknowledge_activity(uuid,text)',
    'public.app_mark_notification(uuid,boolean)'
  ]
  LOOP
    IF to_regprocedure(v_signature) IS NULL THEN
      RAISE EXCEPTION 'Missing RPC: %', v_signature;
    END IF;
    IF NOT has_function_privilege('authenticated', v_signature, 'EXECUTE')
       OR has_function_privilege('anon', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Invalid RPC privileges: %', v_signature;
    END IF;
  END LOOP;
END;
$audit$;

SELECT 'migration_036_verified' AS result, now() AS checked_at;
