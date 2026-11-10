-- Run this read-only audit in Supabase SQL Editor before migration 035.
-- It raises an exception when the existing remote schema is incompatible.
DO $audit$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(required.object_name ORDER BY required.object_name)
  INTO v_missing
  FROM (VALUES
    ('public.users'),
    ('public.daycares'),
    ('public.daycare_members'),
    ('public.children'),
    ('public.service_offerings'),
    ('public.service_price_versions'),
    ('public.enrollments'),
    ('public.enrollment_consents'),
    ('public.enrollment_status_logs'),
    ('public.charges'),
    ('public.transactions'),
    ('public.payment_details'),
    ('public.commission_rules'),
    ('public.notifications'),
    ('public.audit_logs')
  ) AS required(object_name)
  WHERE to_regclass(required.object_name) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required tables: %', v_missing;
  END IF;

  SELECT array_agg(required.signature ORDER BY required.signature)
  INTO v_missing
  FROM (VALUES
    ('public.app_current_role()'),
    ('public.app_is_daycare_manager(uuid)')
  ) AS required(signature)
  WHERE to_regprocedure(required.signature) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required authorization helpers: %', v_missing;
  END IF;

  SELECT array_agg(label.column_ref ORDER BY label.column_ref)
  INTO v_missing
  FROM (VALUES
    ('children', 'id'), ('children', 'parent_id'), ('children', 'birth_date'),
    ('service_offerings', 'published_price_id'), ('service_offerings', 'min_age_months'),
    ('service_offerings', 'max_age_months'), ('service_price_versions', 'service_amount'),
    ('enrollments', 'manager_decision'), ('enrollments', 'payment_deadline'),
    ('charges', 'daycare_commission_amount'), ('notifications', 'deduplication_key'),
    ('audit_logs', 'request_id')
  ) AS required(table_name, column_name)
  CROSS JOIN LATERAL (
    SELECT required.table_name || '.' || required.column_name AS column_ref
  ) AS label
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = required.table_name
      AND c.column_name = required.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required columns: %', v_missing;
  END IF;
END;
$audit$;

SELECT
  'enrollment_backend_preflight_passed' AS result,
  current_database() AS database_name,
  now() AS checked_at;
