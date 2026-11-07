DO $audit$
DECLARE v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.app_manager_check_in_enrollment(uuid,text)',
    'public.app_manager_complete_enrollment(uuid,text,text)',
    'public.app_create_incident(uuid,timestamp with time zone,text,text,text,text,text,text)',
    'public.app_update_incident_status(uuid,text,text,text)',
    'public.app_parent_acknowledge_incident(uuid)'
  ] LOOP
    IF to_regprocedure(v_signature) IS NULL
       OR NOT has_function_privilege('authenticated', v_signature, 'EXECUTE')
       OR has_function_privilege('anon', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Invalid incident RPC: %', v_signature;
    END IF;
  END LOOP;
END;
$audit$;

SELECT 'migration_037_verified' AS result, now() AS checked_at;
