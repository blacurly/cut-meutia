-- Read-only review needed before applying migration 030.
SELECT jsonb_build_object(
  'kind', 'storage_policy',
  'table', tablename,
  'policy', policyname,
  'roles', roles,
  'command', cmd,
  'using', qual,
  'check', with_check
) AS review_item
FROM pg_policies
WHERE schemaname = 'storage'

UNION ALL

SELECT jsonb_build_object(
  'kind', 'helper_function',
  'function', p.oid::regprocedure::text,
  'security_definer', p.prosecdef,
  'settings', p.proconfig,
  'definition', pg_get_functiondef(p.oid)
) AS review_item
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
    'app_is_parent_of_child'
  )

UNION ALL

SELECT jsonb_build_object(
  'kind', 'public_schema_create_access',
  'anon_can_create', has_schema_privilege('anon', 'public', 'CREATE'),
  'authenticated_can_create', has_schema_privilege('authenticated', 'public', 'CREATE')
) AS review_item;
