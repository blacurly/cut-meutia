DO $audit$
DECLARE v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.app_submit_review(uuid,integer,text,text)',
    'public.app_admin_moderate_review(uuid,text,text,text)',
    'public.app_manager_submit_review_reply(uuid,text,text)',
    'public.app_admin_moderate_review_reply(uuid,text,text,text)',
    'public.app_parent_withdraw_review(uuid,text,text)'
  ] LOOP
    IF to_regprocedure(v_signature) IS NULL
       OR NOT has_function_privilege('authenticated', v_signature, 'EXECUTE')
       OR has_function_privilege('anon', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Invalid review RPC: %', v_signature;
    END IF;
  END LOOP;
END;
$audit$;
SELECT 'migration_038_verified' AS result, now() AS checked_at;
