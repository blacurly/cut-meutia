BEGIN;

CREATE OR REPLACE FUNCTION public.app_save_daily_activity(
  p_activity_id uuid,
  p_enrollment_id uuid,
  p_report_date date,
  p_activity_type text,
  p_title text,
  p_body text,
  p_occurred_at timestamptz,
  p_details jsonb,
  p_status text,
  p_is_urgent boolean,
  p_urgent_reason text,
  p_change_reason text,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_enrollment public.enrollments%ROWTYPE;
  v_report_id uuid;
  v_activity public.daily_report_activities%ROWTYPE;
  v_activity_id uuid;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF COALESCE(p_activity_type, '') NOT IN ('play', 'learning', 'interaction', 'meal', 'sleep', 'other')
     OR COALESCE(p_status, '') NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_activity_type_or_status';
  END IF;
  IF p_report_date IS NULL OR p_report_date > CURRENT_DATE
     OR p_occurred_at IS NULL OR p_occurred_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_activity_time';
  END IF;
  IF char_length(btrim(COALESCE(p_title, ''))) NOT BETWEEN 3 AND 100
     OR char_length(btrim(COALESCE(p_body, ''))) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_activity_content';
  END IF;
  IF COALESCE(p_is_urgent, false)
     AND char_length(btrim(COALESCE(p_urgent_reason, ''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'urgent_reason_required';
  END IF;

  SELECT * INTO v_enrollment
  FROM public.enrollments
  WHERE id = p_enrollment_id
  FOR SHARE;
  IF NOT FOUND OR v_enrollment.status <> 'approved'
     OR NOT public.app_is_current_assigned_caregiver(p_enrollment_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'active_caregiver_assignment_required';
  END IF;
  IF p_report_date <> v_enrollment.service_date THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'report_date_outside_service';
  END IF;

  INSERT INTO public.daily_reports (enrollment_id, report_date, created_by)
  VALUES (p_enrollment_id, p_report_date, v_user_id)
  ON CONFLICT (enrollment_id, report_date) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_report_id;

  IF p_activity_id IS NULL THEN
    INSERT INTO public.daily_report_activities (
      report_id, caregiver_id, activity_type, title, body, occurred_at,
      details, status, is_urgent, urgent_reason, sent_at, draft_ai_job_id
    ) VALUES (
      v_report_id, v_user_id, p_activity_type, btrim(p_title), btrim(p_body),
      p_occurred_at, COALESCE(p_details, '{}'::jsonb), p_status,
      COALESCE(p_is_urgent, false),
      CASE WHEN p_is_urgent THEN btrim(p_urgent_reason) ELSE NULL END,
      CASE WHEN p_status = 'sent' THEN now() ELSE NULL END,
      NULL
    ) RETURNING id INTO v_activity_id;
  ELSE
    SELECT * INTO v_activity
    FROM public.daily_report_activities
    WHERE id = p_activity_id
    FOR UPDATE;
    IF NOT FOUND OR v_activity.report_id <> v_report_id
       OR v_activity.caregiver_id <> v_user_id THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'activity_not_owned';
    END IF;
    IF v_activity.status <> 'draft' OR v_activity.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'sent_activity_is_immutable';
    END IF;
    IF char_length(btrim(COALESCE(p_change_reason, ''))) < 5 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'change_reason_required';
    END IF;

    UPDATE public.daily_report_activities
    SET activity_type = p_activity_type,
        title = btrim(p_title), body = btrim(p_body),
        occurred_at = p_occurred_at,
        details = COALESCE(p_details, '{}'::jsonb),
        status = p_status, is_urgent = COALESCE(p_is_urgent, false),
        urgent_reason = CASE WHEN p_is_urgent THEN btrim(p_urgent_reason) ELSE NULL END,
        sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE NULL END,
        version = version + 1
    WHERE id = p_activity_id;

    INSERT INTO public.report_change_logs (
      activity_id, changed_by, before_title, after_title,
      before_body, after_body, reason, from_version, to_version
    ) VALUES (
      p_activity_id, v_user_id, v_activity.title, btrim(p_title),
      v_activity.body, btrim(p_body), btrim(p_change_reason),
      v_activity.version, v_activity.version + 1
    );
    v_activity_id := p_activity_id;
  END IF;

  IF p_status = 'sent' THEN
    PERFORM public.app_internal_notify(
      v_enrollment.parent_id,
      CASE WHEN p_is_urgent THEN 'daily_activity_urgent' ELSE 'daily_activity_sent' END,
      CASE WHEN p_is_urgent THEN 'Catatan penting dari pengasuh' ELSE 'Cerita baru hari ini' END,
      btrim(p_title),
      CASE WHEN p_is_urgent THEN 'urgent' ELSE 'normal' END,
      'daily-activity-sent:' || v_activity_id::text,
      p_enrollment_id
    );
  END IF;

  PERFORM public.app_internal_audit(
    CASE WHEN p_activity_id IS NULL THEN 'daily_activity.create' ELSE 'daily_activity.update' END,
    'daily_report_activity', v_activity_id, v_enrollment.daycare_id,
    p_change_reason, NULL,
    jsonb_build_object('status', p_status, 'urgent', p_is_urgent), v_request_id
  );
  RETURN v_activity_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_acknowledge_activity(
  p_activity_id uuid,
  p_ack_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_activity public.daily_report_activities%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE;
BEGIN
  IF COALESCE(p_ack_type, '') NOT IN ('manager_review', 'parent_read') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_ack_type';
  END IF;
  SELECT * INTO v_activity
  FROM public.daily_report_activities
  WHERE id = p_activity_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'activity_not_found';
  END IF;
  SELECT e.* INTO v_enrollment
  FROM public.daily_reports AS dr
  JOIN public.enrollments AS e ON e.id = dr.enrollment_id
  WHERE dr.id = v_activity.report_id;

  IF (p_ack_type = 'parent_read'
      AND (v_enrollment.parent_id <> auth.uid() OR v_activity.status <> 'sent'))
     OR (p_ack_type = 'manager_review'
      AND NOT public.app_is_daycare_manager(v_enrollment.daycare_id)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'acknowledgement_not_allowed';
  END IF;

  INSERT INTO public.activity_acknowledgements (
    activity_id, user_id, ack_type, acknowledged_at
  ) VALUES (p_activity_id, auth.uid(), p_ack_type, now())
  ON CONFLICT (activity_id, ack_type) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        acknowledged_at = EXCLUDED.acknowledged_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_mark_notification(
  p_notification_id uuid,
  p_read boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE id = p_notification_id AND recipient_id = v_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'notification_not_owned';
  END IF;
  INSERT INTO public.notification_receipts (
    notification_id, user_id, seen_at, read_at
  ) VALUES (
    p_notification_id, v_user_id, now(),
    CASE WHEN p_read THEN now() ELSE NULL END
  )
  ON CONFLICT (notification_id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        seen_at = COALESCE(notification_receipts.seen_at, EXCLUDED.seen_at),
        read_at = CASE WHEN p_read THEN now() ELSE notification_receipts.read_at END;
END;
$function$;

REVOKE ALL ON FUNCTION public.app_save_daily_activity(uuid, uuid, date, text, text, text, timestamptz, jsonb, text, boolean, text, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_acknowledge_activity(uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_mark_notification(uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_save_daily_activity(uuid, uuid, date, text, text, text, timestamptz, jsonb, text, boolean, text, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_acknowledge_activity(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_mark_notification(uuid, boolean)
  TO authenticated;

COMMIT;
