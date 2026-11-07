BEGIN;

-- SECURITY DEFINER checks let RLS verify staff scope without granting staff
-- direct SELECT access to the enrollment table.
CREATE OR REPLACE FUNCTION public.app_can_manager_read_current_child_health(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.child_id = p_child_id
      AND e.status = 'approved'
      AND public.app_is_daycare_manager(e.daycare_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.app_can_caregiver_read_current_child_health(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.child_id = p_child_id
      AND e.status = 'approved'
      AND public.app_is_current_assigned_caregiver(e.id)
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.app_can_manager_read_current_child_health(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_can_manager_read_current_child_health(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.app_can_caregiver_read_current_child_health(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_can_caregiver_read_current_child_health(uuid) TO authenticated;
GRANT SELECT ON TABLE public.child_health_profiles TO authenticated;

-- Policy helper functions are SECURITY DEFINER and are used only by
-- authenticated RLS policies. Remove PostgreSQL's default PUBLIC execution.
REVOKE EXECUTE ON FUNCTION public.app_can_parent_read_logbook_variant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_can_parent_read_logbook_variant(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.app_can_read_incident_storage_object(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_can_read_incident_storage_object(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.app_can_read_pickup_storage_object(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_can_read_pickup_storage_object(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.app_current_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_current_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.app_is_active_daycare_member(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_is_active_daycare_member(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.app_is_current_assigned_caregiver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_is_current_assigned_caregiver(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.app_is_daycare_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_is_daycare_manager(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.app_is_parent_of_child(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_is_parent_of_child(uuid) TO authenticated;

-- Trigger function is not an API/RPC. Existing trigger continues to invoke it.
REVOKE EXECUTE ON FUNCTION public.create_parent_profile_for_auth_user()
  FROM PUBLIC, anon, authenticated, service_role;

-- Remove the redundant self-read policy; keep users_select_own_profile.
DROP POLICY IF EXISTS users_select_self ON public.users;

-- A Caregiver may read only reports and activities they authored. New writes
-- must use a trusted RPC that checks the current assignment.
DROP POLICY IF EXISTS daily_reports_assigned_caregiver_read ON public.daily_reports;
DROP POLICY IF EXISTS daily_reports_caregiver_own_read ON public.daily_reports;
CREATE POLICY daily_reports_caregiver_own_read
  ON public.daily_reports
  FOR SELECT
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS daily_report_activities_caregiver_read ON public.daily_report_activities;
DROP POLICY IF EXISTS daily_report_activities_caregiver_own_read ON public.daily_report_activities;
CREATE POLICY daily_report_activities_caregiver_own_read
  ON public.daily_report_activities
  FOR SELECT
  TO authenticated
  USING (caregiver_id = (SELECT auth.uid()));

-- Staff can read current health data only while the relevant business scope
-- is active. Historical health logs remain Parent-owned by policy.
DROP POLICY IF EXISTS child_health_profiles_manager_approved_read ON public.child_health_profiles;
CREATE POLICY child_health_profiles_manager_approved_read
  ON public.child_health_profiles
  FOR SELECT
  TO authenticated
  USING (public.app_can_manager_read_current_child_health(child_id));

DROP POLICY IF EXISTS child_health_profiles_assigned_caregiver_read ON public.child_health_profiles;
CREATE POLICY child_health_profiles_assigned_caregiver_read
  ON public.child_health_profiles
  FOR SELECT
  TO authenticated
  USING (public.app_can_caregiver_read_current_child_health(child_id));

COMMIT;
