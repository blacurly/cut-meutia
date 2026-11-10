-- Support for the non-AI REST API (app/api/*):
-- 1. Write RPCs that complete CRUD for children and daily-activity drafts.
-- 2. Read RPCs with explicit, role-scoped results. The live RLS policies only
--    cover Parent reads; Managers have no read policy on enrollments, and the
--    business rules (docs/alur-bisnis-dan-database-ayomi.md 4.2) require that a
--    daycare does not see child identity before an enrollment is approved.
--    These functions encode that redaction in one place.
-- Upgrade-only: CREATE OR REPLACE FUNCTION plus grants. Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------- children

CREATE OR REPLACE FUNCTION public.app_parent_update_child(
  p_child_id uuid,
  p_full_name text,
  p_birth_date date,
  p_gender text,
  p_general_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_parent_id uuid := auth.uid();
  v_child public.children%ROWTYPE;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'parent_account_not_active';
  END IF;
  IF p_full_name IS NULL OR char_length(btrim(p_full_name)) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_child_name';
  END IF;
  IF p_birth_date IS NULL OR p_birth_date > CURRENT_DATE THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_child_birth_date';
  END IF;
  IF (p_gender IS NOT NULL AND p_gender NOT IN ('female', 'male'))
     OR char_length(COALESCE(p_general_notes, '')) > 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_child_fields';
  END IF;

  SELECT * INTO v_child
  FROM public.children
  WHERE child_id = p_child_id AND parent_id = v_parent_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'child_not_owned';
  END IF;
  -- Age eligibility was checked against the stored birth date; it may not
  -- change once the child appears in any enrollment.
  IF p_birth_date IS DISTINCT FROM v_child.birth_date
     AND EXISTS (SELECT 1 FROM public.enrollments WHERE child_id = p_child_id) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'child_has_enrollment_history';
  END IF;

  UPDATE public.children
  SET full_name = btrim(p_full_name),
      birth_date = p_birth_date,
      gender = p_gender,
      general_notes = NULLIF(btrim(COALESCE(p_general_notes, '')), ''),
      updated_at = now()
  WHERE child_id = p_child_id;
END;
$function$;

-- Soft delete; children referenced by enrollments stay for the audit trail.
CREATE OR REPLACE FUNCTION public.app_parent_archive_child(p_child_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'parent_account_not_active';
  END IF;
  PERFORM 1 FROM public.children
  WHERE child_id = p_child_id AND parent_id = auth.uid() AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'child_not_owned';
  END IF;
  IF EXISTS (SELECT 1 FROM public.enrollments WHERE child_id = p_child_id) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'child_has_enrollment_history';
  END IF;
  UPDATE public.children
  SET status = 'inactive', deleted_at = now(), updated_at = now()
  WHERE child_id = p_child_id;
END;
$function$;

-- ------------------------------------------------------------- daily log

-- Only the author may discard an unsent draft. Sent activities are immutable.
CREATE OR REPLACE FUNCTION public.app_delete_draft_activity(p_activity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_activity public.daily_report_activities%ROWTYPE;
BEGIN
  SELECT * INTO v_activity
  FROM public.daily_report_activities
  WHERE id = p_activity_id
  FOR UPDATE;
  IF NOT FOUND OR v_activity.deleted_at IS NOT NULL
     OR v_activity.caregiver_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'activity_not_owned';
  END IF;
  IF v_activity.status <> 'draft' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'sent_activity_is_immutable';
  END IF;
  UPDATE public.daily_report_activities
  SET deleted_at = now(), version = version + 1, updated_at = now()
  WHERE id = p_activity_id;
END;
$function$;

-- ------------------------------------------------------------ enrollments

-- One JSON shape for every audience. Child identity is included only for the
-- Parent, or for staff once the enrollment is approved/completed.
CREATE OR REPLACE FUNCTION public.app_internal_enrollment_json(
  p_enrollment public.enrollments,
  p_audience text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT jsonb_build_object(
    'id', p_enrollment.id,
    'reference', upper(left(replace(p_enrollment.id::text, '-', ''), 8)),
    'status', p_enrollment.status,
    'manager_decision', p_enrollment.manager_decision,
    'service_date', p_enrollment.service_date,
    'payment_deadline', p_enrollment.payment_deadline,
    'decision_reason', p_enrollment.decision_reason,
    'checked_in_at', p_enrollment.checked_in_at,
    'completed_at', p_enrollment.completed_at,
    'created_at', p_enrollment.created_at,
    'daycare', (SELECT jsonb_build_object('id', d.id, 'name', d.name)
                FROM public.daycares AS d WHERE d.id = p_enrollment.daycare_id),
    'offering', (SELECT jsonb_build_object('id', o.id, 'name', o.name, 'service_type', o.service_type)
                 FROM public.service_offerings AS o WHERE o.id = p_enrollment.offering_id),
    'child', CASE
      WHEN p_audience = 'parent' OR p_enrollment.status IN ('approved', 'completed')
      THEN jsonb_build_object(
        'child_id', p_enrollment.child_id,
        'full_name', p_enrollment.child_snapshot ->> 'full_name',
        'birth_date', p_enrollment.child_snapshot ->> 'birth_date')
      ELSE NULL END,
    'charge', CASE WHEN p_audience IN ('parent', 'manager') THEN (
      SELECT jsonb_build_object('id', c.id, 'total_amount', c.total_amount, 'currency', c.currency,
                                'status', c.status, 'due_at', c.due_at)
      FROM public.charges AS c
      WHERE c.enrollment_id = p_enrollment.id AND c.charge_type = 'service') END
  );
$function$;

CREATE OR REPLACE FUNCTION public.app_list_enrollments(p_daycare_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF p_daycare_id IS NULL THEN
    IF public.app_current_role() IS DISTINCT FROM 'parent' THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'parent_account_not_active';
    END IF;
    RETURN COALESCE((
      SELECT jsonb_agg(public.app_internal_enrollment_json(e, 'parent')
                       ORDER BY e.service_date DESC, e.created_at DESC)
      FROM (SELECT * FROM public.enrollments WHERE parent_id = auth.uid()
            ORDER BY service_date DESC, created_at DESC LIMIT 200) AS e
    ), '[]'::jsonb);
  END IF;

  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(public.app_internal_enrollment_json(e, 'manager')
                     ORDER BY e.service_date DESC, e.created_at DESC)
    FROM (SELECT * FROM public.enrollments WHERE daycare_id = p_daycare_id
          ORDER BY service_date DESC, created_at DESC LIMIT 200) AS e
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_get_enrollment(p_enrollment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_audience text;
BEGIN
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = p_enrollment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'enrollment_not_found';
  END IF;
  IF v_enrollment.parent_id = auth.uid() THEN
    v_audience := 'parent';
  ELSIF COALESCE(public.app_is_daycare_manager(v_enrollment.daycare_id), false) THEN
    v_audience := 'manager';
  ELSIF COALESCE(public.app_is_current_assigned_caregiver(v_enrollment.id), false) THEN
    v_audience := 'caregiver';
  ELSE
    -- Same answer as a missing row: never confirm a foreign enrollment exists.
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'enrollment_not_found';
  END IF;

  RETURN public.app_internal_enrollment_json(v_enrollment, v_audience)
    || jsonb_build_object(
      'viewer_role', v_audience,
      'status_logs', CASE WHEN v_audience = 'caregiver' THEN '[]'::jsonb ELSE COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'from_status', l.from_status, 'to_status', l.to_status,
          'actor_type', l.actor_type, 'reason', l.reason, 'created_at', l.created_at)
          ORDER BY l.created_at)
        FROM public.enrollment_status_logs AS l WHERE l.enrollment_id = v_enrollment.id
      ), '[]'::jsonb) END,
      'caregivers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'assignment_id', a.id, 'caregiver_id', a.caregiver_id, 'full_name', u.full_name,
          'starts_at', a.starts_at, 'ends_at', a.ends_at) ORDER BY a.starts_at)
        FROM public.caregiver_assignments AS a
        JOIN public.users AS u ON u.id = a.caregiver_id
        WHERE a.enrollment_id = v_enrollment.id AND a.ended_early_at IS NULL
      ), '[]'::jsonb)
    );
END;
$function$;

-- Daycares the caller manages or works at (staff need the id for queues).
CREATE OR REPLACE FUNCTION public.app_list_my_daycares()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id, 'name', d.name, 'status', d.status, 'member_role', m.member_role,
    'is_main_manager', d.main_manager_id = auth.uid()) ORDER BY d.name), '[]'::jsonb)
  FROM public.daycare_members AS m
  JOIN public.daycares AS d ON d.id = m.daycare_id AND d.deleted_at IS NULL
  WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.ended_at IS NULL;
$function$;

-- --------------------------------------------------------- daily activities

CREATE OR REPLACE FUNCTION public.app_list_daily_activities(p_enrollment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_own_only boolean := false;
BEGIN
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = p_enrollment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'enrollment_not_found';
  END IF;
  IF v_enrollment.parent_id = auth.uid()
     OR COALESCE(public.app_is_daycare_manager(v_enrollment.daycare_id), false) THEN
    v_own_only := false;  -- sent activities only
  ELSIF COALESCE(public.app_is_current_assigned_caregiver(v_enrollment.id), false) THEN
    v_own_only := true;   -- the caregiver's own drafts and sent activities
  ELSE
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'enrollment_not_found';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', a.id, 'report_date', r.report_date, 'activity_type', a.activity_type,
      'title', a.title, 'body', a.body, 'occurred_at', a.occurred_at, 'status', a.status,
      'is_urgent', a.is_urgent, 'urgent_reason', a.urgent_reason, 'sent_at', a.sent_at,
      'version', a.version, 'caregiver_name', u.full_name,
      'parent_read_at', (SELECT k.acknowledged_at FROM public.activity_acknowledgements AS k
                         WHERE k.activity_id = a.id AND k.ack_type = 'parent_read'))
      ORDER BY a.occurred_at DESC)
    FROM public.daily_report_activities AS a
    JOIN public.daily_reports AS r ON r.id = a.report_id
    JOIN public.users AS u ON u.id = a.caregiver_id
    WHERE r.enrollment_id = v_enrollment.id
      AND a.deleted_at IS NULL
      AND (CASE WHEN v_own_only THEN a.caregiver_id = auth.uid() ELSE a.status = 'sent' END)
  ), '[]'::jsonb);
END;
$function$;

-- ------------------------------------------------------------ notifications

CREATE OR REPLACE FUNCTION public.app_list_my_notifications(
  p_only_unread boolean DEFAULT false,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;
  RETURN jsonb_build_object(
    'unread_count', (
      SELECT count(*) FROM public.notifications AS n
      LEFT JOIN public.notification_receipts AS r ON r.notification_id = n.id
      WHERE n.recipient_id = v_user_id AND n.available_at <= now() AND r.read_at IS NULL),
    'items', COALESCE((
      SELECT jsonb_agg(item ORDER BY created_at DESC) FROM (
        SELECT n.created_at, jsonb_build_object(
          'id', n.id, 'event_type', n.event_type, 'title', n.title, 'body', n.body,
          'priority', n.priority, 'enrollment_id', n.enrollment_id,
          'created_at', n.created_at, 'read_at', r.read_at) AS item
        FROM public.notifications AS n
        LEFT JOIN public.notification_receipts AS r ON r.notification_id = n.id
        WHERE n.recipient_id = v_user_id AND n.available_at <= now()
          AND (NOT COALESCE(p_only_unread, false) OR r.read_at IS NULL)
        ORDER BY n.created_at DESC
        LIMIT v_limit) AS page
    ), '[]'::jsonb)
  );
END;
$function$;

-- ---------------------------------------------------------------- incidents

-- Parent: own children; Manager: own daycare; Admin: all. Caregivers report
-- incidents but may not list them (docs/alur-bisnis 3.1).
CREATE OR REPLACE FUNCTION public.app_list_incidents(p_enrollment_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text := public.app_current_role();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('parent', 'manager', 'admin') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(item ORDER BY created_at DESC) FROM (
      SELECT i.created_at, jsonb_build_object(
        'id', i.id, 'enrollment_id', i.enrollment_id,
        'daycare', jsonb_build_object('id', d.id, 'name', d.name),
        'child_name', e.child_snapshot ->> 'full_name',
        'occurred_at', i.occurred_at, 'description', i.description, 'first_aid', i.first_aid,
        'urgency', i.effective_urgency, 'urgency_source', i.urgency_source,
        'status', i.status, 'resolved_at', i.resolved_at, 'created_at', i.created_at,
        'parent_acknowledged_at', (SELECT k.acknowledged_at FROM public.incident_parent_acknowledgements AS k
                                   WHERE k.incident_id = i.id),
        'status_logs', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('from_status', l.from_status, 'to_status', l.to_status,
                                              'reason', l.reason, 'created_at', l.created_at) ORDER BY l.created_at)
          FROM public.incident_status_logs AS l WHERE l.incident_id = i.id), '[]'::jsonb)) AS item
      FROM public.incident_reports AS i
      JOIN public.enrollments AS e ON e.id = i.enrollment_id
      JOIN public.daycares AS d ON d.id = e.daycare_id
      WHERE (p_enrollment_id IS NULL OR i.enrollment_id = p_enrollment_id)
        AND CASE v_role
          WHEN 'parent' THEN e.parent_id = auth.uid()
          WHEN 'manager' THEN COALESCE(public.app_is_daycare_manager(e.daycare_id), false)
          ELSE true END
      ORDER BY i.created_at DESC
      LIMIT 200) AS page
  ), '[]'::jsonb);
END;
$function$;

-- ----------------------------------------------- public catalog for partners

CREATE OR REPLACE FUNCTION public.app_list_daycare_offerings(p_daycare_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id, 'name', o.name, 'service_type', o.service_type, 'description', o.description,
    'min_age_months', o.min_age_months, 'max_age_months', o.max_age_months,
    'price', jsonb_build_object('amount', p.service_amount, 'currency', p.currency, 'version', p.version))
    ORDER BY o.name), '[]'::jsonb)
  FROM public.service_offerings AS o
  JOIN public.daycares AS d ON d.id = o.daycare_id AND d.status = 'active' AND d.deleted_at IS NULL
  JOIN public.service_price_versions AS p ON p.id = o.published_price_id AND p.status = 'approved'
  WHERE o.daycare_id = p_daycare_id AND o.is_active;
$function$;

-- Published, non-withdrawn reviews only. The author is never exposed.
CREATE OR REPLACE FUNCTION public.app_list_public_reviews(p_daycare_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH published AS (
    SELECT r.id, v.rating, v.body, v.moderated_at,
      (SELECT jsonb_build_object('body', rv.body, 'published_at', rv.moderated_at)
       FROM public.review_replies AS rr
       JOIN public.review_reply_versions AS rv ON rv.id = rr.published_version_id
       WHERE rr.review_id = r.id) AS reply
    FROM public.reviews AS r
    JOIN public.review_versions AS v ON v.id = r.published_version_id
    WHERE r.daycare_id = p_daycare_id AND r.withdrawn_at IS NULL
  )
  SELECT jsonb_build_object(
    'count', (SELECT count(*) FROM published),
    'average_rating', (SELECT round(avg(rating)::numeric, 1) FROM published),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'rating', rating, 'body', body, 'published_at', moderated_at, 'reply', reply)
      ORDER BY moderated_at DESC) FROM published), '[]'::jsonb));
$function$;

-- ---------------------------------------------------------- admin moderation

CREATE OR REPLACE FUNCTION public.app_admin_list_moderation_queue()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  RETURN jsonb_build_object(
    'reviews', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'version_id', v.id, 'review_id', r.id, 'daycare', jsonb_build_object('id', d.id, 'name', d.name),
        'rating', v.rating, 'body', v.body, 'submitted_at', v.created_at) ORDER BY v.created_at)
      FROM public.review_versions AS v
      JOIN public.reviews AS r ON r.id = v.review_id
      JOIN public.daycares AS d ON d.id = r.daycare_id
      WHERE v.moderation_status = 'pending'), '[]'::jsonb),
    'replies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'version_id', rv.id, 'review_id', rr.review_id, 'daycare', jsonb_build_object('id', d.id, 'name', d.name),
        'body', rv.body, 'submitted_at', rv.created_at) ORDER BY rv.created_at)
      FROM public.review_reply_versions AS rv
      JOIN public.review_replies AS rr ON rr.id = rv.reply_id
      JOIN public.reviews AS r ON r.id = rr.review_id
      JOIN public.daycares AS d ON d.id = r.daycare_id
      WHERE rv.status = 'pending'), '[]'::jsonb)
  );
END;
$function$;

-- ------------------------------------------------------------------- grants

REVOKE ALL ON FUNCTION public.app_internal_enrollment_json(public.enrollments, text)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.app_parent_update_child(uuid, text, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_parent_archive_child(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_delete_draft_activity(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_list_enrollments(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_get_enrollment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_list_my_daycares() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_list_daily_activities(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_list_my_notifications(boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_list_incidents(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_list_moderation_queue() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_list_daycare_offerings(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_list_public_reviews(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.app_parent_update_child(uuid, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_parent_archive_child(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_delete_draft_activity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_enrollments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_enrollment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_my_daycares() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_daily_activities(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_my_notifications(boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_incidents(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_list_moderation_queue() TO authenticated;
-- Public catalog data: visitors may read offerings and published reviews.
GRANT EXECUTE ON FUNCTION public.app_list_daycare_offerings(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_public_reviews(uuid) TO anon, authenticated;

COMMIT;
