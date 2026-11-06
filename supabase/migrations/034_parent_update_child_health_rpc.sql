BEGIN;

CREATE OR REPLACE FUNCTION public.app_parent_update_child_health(
  p_child_id uuid,
  p_allergies text,
  p_medical_history text,
  p_special_needs text,
  p_medication_notes text,
  p_reason text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_parent_id uuid := auth.uid();
  v_profile public.child_health_profiles%ROWTYPE;
  v_before_data jsonb;
  v_after_data jsonb;
  v_log_id uuid;
  v_reason text := NULLIF(btrim(p_reason), '');
  v_new_version integer;
BEGIN
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS u
    WHERE u.id = v_parent_id
      AND u.role = 'parent'
      AND u.status = 'active'
      AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'parent_account_not_active';
  END IF;

  IF p_child_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.children AS c
    WHERE c.child_id = p_child_id
      AND c.parent_id = v_parent_id
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'child_not_owned';
  END IF;

  IF char_length(COALESCE(p_allergies, '')) > 4000
     OR char_length(COALESCE(p_medical_history, '')) > 4000
     OR char_length(COALESCE(p_special_needs, '')) > 4000
     OR char_length(COALESCE(p_medication_notes, '')) > 4000
     OR char_length(COALESCE(v_reason, '')) > 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'health_text_too_long';
  END IF;

  -- Serialize edits for this child and create an empty profile if this is an
  -- older child row that predates profile initialization.
  PERFORM 1
  FROM public.children AS c
  WHERE c.child_id = p_child_id
    AND c.parent_id = v_parent_id
    AND c.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'child_not_owned';
  END IF;

  INSERT INTO public.child_health_profiles (child_id, updated_by)
  VALUES (p_child_id, v_parent_id)
  ON CONFLICT (child_id) DO NOTHING;

  SELECT * INTO v_profile
  FROM public.child_health_profiles AS hp
  WHERE hp.child_id = p_child_id
  FOR UPDATE;

  v_before_data := jsonb_build_object(
    'allergies', v_profile.allergies,
    'medical_history', v_profile.medical_history,
    'special_needs', v_profile.special_needs,
    'medication_notes', v_profile.medication_notes
  );
  v_after_data := jsonb_build_object(
    'allergies', NULLIF(btrim(p_allergies), ''),
    'medical_history', NULLIF(btrim(p_medical_history), ''),
    'special_needs', NULLIF(btrim(p_special_needs), ''),
    'medication_notes', NULLIF(btrim(p_medication_notes), '')
  );

  IF v_before_data = v_after_data THEN
    RETURN v_profile.version;
  END IF;

  v_new_version := v_profile.version + 1;

  UPDATE public.child_health_profiles
  SET allergies = v_after_data ->> 'allergies',
      medical_history = v_after_data ->> 'medical_history',
      special_needs = v_after_data ->> 'special_needs',
      medication_notes = v_after_data ->> 'medication_notes',
      version = v_new_version,
      updated_by = v_parent_id,
      updated_at = now()
  WHERE child_id = p_child_id;

  INSERT INTO public.child_health_change_logs (
    child_id, from_version, to_version, before_data, after_data, changed_by, reason
  ) VALUES (
    p_child_id, v_profile.version, v_new_version,
    v_before_data, v_after_data, v_parent_id, v_reason
  )
  RETURNING id INTO v_log_id;

  -- Notify only currently authorized daycare staff. The notice contains no
  -- health details; staff must re-check access before opening the profile.
  WITH approved_daycares AS (
    SELECT DISTINCT e.daycare_id
    FROM public.enrollments AS e
    WHERE e.child_id = p_child_id
      AND e.status = 'approved'
  ), eligible_recipients AS (
    SELECT d.main_manager_id AS recipient_id
    FROM approved_daycares AS ad
    JOIN public.daycares AS d ON d.id = ad.daycare_id
    JOIN public.users AS u ON u.id = d.main_manager_id
    JOIN public.daycare_members AS dm
      ON dm.daycare_id = d.id
     AND dm.user_id = u.id
     AND dm.member_role = 'manager'
     AND dm.status = 'active'
    WHERE d.status = 'active'
      AND d.deleted_at IS NULL
      AND u.role = 'manager'
      AND u.status = 'active'
      AND u.deleted_at IS NULL

    UNION

    SELECT ca.caregiver_id AS recipient_id
    FROM public.enrollments AS e
    JOIN public.caregiver_assignments AS ca ON ca.enrollment_id = e.id
    JOIN public.daycare_members AS dm
      ON dm.daycare_id = e.daycare_id
     AND dm.user_id = ca.caregiver_id
     AND dm.member_role = 'caregiver'
     AND dm.status = 'active'
    JOIN public.users AS u ON u.id = ca.caregiver_id
    WHERE e.child_id = p_child_id
      AND e.status = 'approved'
      AND ca.starts_at <= now()
      AND ca.ends_at > now()
      AND ca.ended_early_at IS NULL
      AND u.role = 'caregiver'
      AND u.status = 'active'
      AND u.deleted_at IS NULL
  )
  INSERT INTO public.notifications (
    recipient_id, event_type, health_change_id, title, body,
    priority, deduplication_key, available_at
  )
  SELECT DISTINCT
    er.recipient_id,
    'child_health_updated',
    v_log_id,
    'Informasi kesehatan anak diperbarui',
    'Orang tua memperbarui informasi kesehatan. Buka aplikasi untuk memeriksa akses dan melihat data terbaru.',
    'normal',
    'child-health-updated:' || v_log_id::text || ':' || er.recipient_id::text,
    now()
  FROM eligible_recipients AS er
  WHERE er.recipient_id <> v_parent_id
  ON CONFLICT (deduplication_key) DO NOTHING;

  RETURN v_new_version;
END;
$function$;

REVOKE ALL ON FUNCTION public.app_parent_update_child_health(uuid, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_parent_update_child_health(uuid, text, text, text, text, text)
  TO authenticated;

COMMIT;
