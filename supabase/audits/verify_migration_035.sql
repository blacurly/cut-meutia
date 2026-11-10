-- Run after migration 035. Read-only catalog and privilege verification.
DO $audit$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.app_create_enrollment(uuid,uuid,date,text,jsonb,text,text)',
    'public.app_manager_decide_enrollment(uuid,text,text,text)',
    'public.app_parent_cancel_enrollment(uuid,text,text)',
    'public.app_create_payment_ledger_entry(uuid,text,text,timestamp with time zone)',
    'public.app_admin_record_payment_result(uuid,text,text,text,jsonb,bigint,text,text,text)',
    'public.app_manager_assign_caregiver(uuid,uuid,timestamp with time zone,timestamp with time zone,text)'
  ]
  LOOP
    IF to_regprocedure(v_signature) IS NULL THEN
      RAISE EXCEPTION 'Missing RPC: %', v_signature;
    END IF;
    IF NOT has_function_privilege('authenticated', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated cannot execute RPC: %', v_signature;
    END IF;
    IF has_function_privilege('anon', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon must not execute RPC: %', v_signature;
    END IF;
  END LOOP;

  -- The expiry job is server-only: never callable from the browser.
  v_signature := 'public.app_expire_overdue_enrollments(integer)';
  IF to_regprocedure(v_signature) IS NULL THEN
    RAISE EXCEPTION 'Missing job function: %', v_signature;
  END IF;
  IF has_function_privilege('anon', v_signature, 'EXECUTE')
     OR has_function_privilege('authenticated', v_signature, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_signature, 'EXECUTE') THEN
    RAISE EXCEPTION 'Expiry job must be executable by service_role only.';
  END IF;

  IF has_table_privilege('authenticated', 'public.enrollments', 'INSERT')
     OR has_table_privilege('authenticated', 'public.enrollments', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.charges', 'INSERT')
     OR has_table_privilege('authenticated', 'public.transactions', 'UPDATE') THEN
    RAISE EXCEPTION 'Direct business-table writes must remain revoked.';
  END IF;
END;
$audit$;

SELECT
  'migration_035_verified' AS result,
  now() AS checked_at;
