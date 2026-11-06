-- Read-only verification for migration 030.
WITH target_functions AS (
  SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'app_can_parent_read_logbook_variant',
      'app_can_read_incident_storage_object',
      'app_can_read_pickup_storage_object',
      'app_current_role',
      'app_is_active_daycare_member',
      'app_is_current_assigned_caregiver',
      'app_is_daycare_manager',
      'app_is_parent_of_child',
      'app_can_manager_read_current_child_health',
      'app_can_caregiver_read_current_child_health',
      'create_parent_profile_for_auth_user'
    )
), checks AS (
  SELECT
    'function_privilege'::text AS check_type,
    format('%I.%I(%s)', 'public', f.proname, f.arguments) AS object_name,
    jsonb_build_object(
      'anon_can_execute', has_function_privilege('anon', f.oid, 'EXECUTE'),
      'authenticated_can_execute', has_function_privilege('authenticated', f.oid, 'EXECUTE'),
      'service_role_can_execute', has_function_privilege('service_role', f.oid, 'EXECUTE')
    ) AS result
  FROM target_functions f

  UNION ALL

  SELECT
    'policy'::text,
    format('%I.%I / %I', schemaname, tablename, policyname),
    jsonb_build_object('command', cmd, 'roles', roles, 'using', qual, 'check', with_check)
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (tablename = 'users' AND policyname IN ('users_select_self', 'users_select_own_profile'))
      OR (tablename = 'daily_reports' AND policyname IN ('daily_reports_assigned_caregiver_read', 'daily_reports_caregiver_own_read'))
      OR (tablename = 'daily_report_activities' AND policyname IN ('daily_report_activities_caregiver_read', 'daily_report_activities_caregiver_own_read'))
      OR (tablename = 'child_health_profiles' AND policyname IN ('child_health_profiles_parent_read', 'child_health_profiles_manager_approved_read', 'child_health_profiles_assigned_caregiver_read'))
    )

  UNION ALL

  SELECT
    'removed_policy'::text,
    'public.users.users_select_self',
    jsonb_build_object('still_present', EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_select_self'
    ))

  UNION ALL

  SELECT
    'removed_policy'::text,
    'public.daily_reports.daily_reports_assigned_caregiver_read',
    jsonb_build_object('still_present', EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'daily_reports' AND policyname = 'daily_reports_assigned_caregiver_read'
    ))

  UNION ALL

  SELECT
    'removed_policy'::text,
    'public.daily_report_activities.daily_report_activities_caregiver_read',
    jsonb_build_object('still_present', EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'daily_report_activities' AND policyname = 'daily_report_activities_caregiver_read'
    ))

  UNION ALL

  SELECT
    'table_privilege'::text,
    'public.child_health_profiles SELECT for authenticated',
    jsonb_build_object('granted', has_table_privilege('authenticated', 'public.child_health_profiles', 'SELECT'))
)
SELECT check_type, object_name, result
FROM checks
ORDER BY check_type, object_name;
