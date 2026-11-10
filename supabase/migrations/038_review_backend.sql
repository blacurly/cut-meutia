BEGIN;

CREATE OR REPLACE FUNCTION public.app_submit_review(
  p_enrollment_id uuid, p_rating integer, p_body text, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_review_id uuid;
  v_version_id uuid;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5
     OR char_length(btrim(COALESCE(p_body, ''))) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_review';
  END IF;
  SELECT * INTO v_enrollment FROM public.enrollments
  WHERE id = p_enrollment_id AND parent_id = auth.uid() AND status = 'completed'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'completed_enrollment_required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reviews
    WHERE parent_id = auth.uid() AND daycare_id = v_enrollment.daycare_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'review_already_exists';
  END IF;
  INSERT INTO public.reviews (parent_id, daycare_id, qualifying_enrollment_id)
  VALUES (auth.uid(), v_enrollment.daycare_id, p_enrollment_id)
  RETURNING id INTO v_review_id;
  INSERT INTO public.review_versions (
    review_id, version, rating, body, moderation_status, ai_job_id
  ) VALUES (v_review_id, 1, p_rating, btrim(p_body), 'pending', NULL)
  RETURNING id INTO v_version_id;
  PERFORM public.app_internal_audit(
    'review.submit', 'review', v_review_id, v_enrollment.daycare_id,
    'Parent submitted review for manual moderation', NULL,
    jsonb_build_object('version_id', v_version_id, 'rating', p_rating), v_request_id
  );
  RETURN v_review_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_moderate_review(
  p_version_id uuid, p_decision text, p_reason text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_version public.review_versions%ROWTYPE;
  v_review public.reviews%ROWTYPE;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin'
     OR COALESCE(p_decision, '') NOT IN ('approved', 'rejected')
     OR char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_review_decision_required';
  END IF;
  SELECT * INTO v_version FROM public.review_versions WHERE id = p_version_id FOR UPDATE;
  IF NOT FOUND OR v_version.moderation_status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'review_version_not_pending';
  END IF;
  SELECT * INTO v_review FROM public.reviews WHERE id = v_version.review_id FOR UPDATE;
  UPDATE public.review_versions
  SET moderation_status = p_decision, moderated_by = auth.uid(), moderated_at = now(),
      moderation_reason = btrim(p_reason)
  WHERE id = p_version_id;
  IF p_decision = 'approved' THEN
    UPDATE public.reviews SET published_version_id = p_version_id WHERE id = v_review.id;
  END IF;
  PERFORM public.app_internal_notify(
    v_review.parent_id, 'review_moderated', 'Ulasan telah ditinjau', btrim(p_reason),
    'normal', 'review-moderated:' || p_version_id::text, NULL
  );
  PERFORM public.app_internal_audit(
    'review.moderate', 'review', v_review.id, v_review.daycare_id, p_reason,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', p_decision),
    v_request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_submit_review_reply(
  p_review_id uuid, p_body text, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_review public.reviews%ROWTYPE;
  v_reply_id uuid;
  v_version integer;
  v_version_id uuid;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF char_length(btrim(COALESCE(p_body, ''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_review_reply';
  END IF;
  SELECT * INTO v_review FROM public.reviews WHERE id = p_review_id FOR SHARE;
  IF NOT FOUND OR v_review.published_version_id IS NULL
     OR NOT public.app_is_daycare_manager(v_review.daycare_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_review_scope_required';
  END IF;
  INSERT INTO public.review_replies (review_id, manager_id)
  VALUES (p_review_id, auth.uid())
  ON CONFLICT (review_id) DO UPDATE SET manager_id = EXCLUDED.manager_id
  RETURNING id INTO v_reply_id;
  SELECT COALESCE(max(version), 0) + 1 INTO v_version
  FROM public.review_reply_versions WHERE reply_id = v_reply_id;
  INSERT INTO public.review_reply_versions (
    reply_id, version, body, status, submitted_by,
    draft_ai_job_id, moderation_ai_job_id
  ) VALUES (v_reply_id, v_version, btrim(p_body), 'pending', auth.uid(), NULL, NULL)
  RETURNING id INTO v_version_id;
  PERFORM public.app_internal_audit(
    'review_reply.submit', 'review_reply', v_reply_id, v_review.daycare_id,
    'Manager submitted reply for manual moderation', NULL,
    jsonb_build_object('version_id', v_version_id), v_request_id
  );
  RETURN v_version_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_moderate_review_reply(
  p_version_id uuid, p_decision text, p_reason text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_version public.review_reply_versions%ROWTYPE;
  v_reply public.review_replies%ROWTYPE;
  v_review public.reviews%ROWTYPE;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin'
     OR COALESCE(p_decision, '') NOT IN ('approved', 'rejected')
     OR char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_reply_decision_required';
  END IF;
  SELECT * INTO v_version FROM public.review_reply_versions WHERE id = p_version_id FOR UPDATE;
  IF NOT FOUND OR v_version.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'reply_version_not_pending';
  END IF;
  SELECT * INTO v_reply FROM public.review_replies WHERE id = v_version.reply_id FOR UPDATE;
  SELECT * INTO v_review FROM public.reviews WHERE id = v_reply.review_id;
  UPDATE public.review_reply_versions
  SET status = p_decision, moderated_by = auth.uid(), moderated_at = now(),
      moderation_reason = btrim(p_reason)
  WHERE id = p_version_id;
  IF p_decision = 'approved' THEN
    UPDATE public.review_replies SET published_version_id = p_version_id WHERE id = v_reply.id;
    PERFORM public.app_internal_notify(
      v_review.parent_id, 'review_reply_published', 'Daycare membalas ulasan Anda',
      'Balasan telah melalui moderasi manual.', 'normal',
      'review-reply-published:' || p_version_id::text, NULL
    );
  END IF;
  PERFORM public.app_internal_audit(
    'review_reply.moderate', 'review_reply', v_reply.id, v_review.daycare_id, p_reason,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', p_decision),
    v_request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_parent_withdraw_review(
  p_review_id uuid, p_reason text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_review public.reviews%ROWTYPE;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  SELECT * INTO v_review FROM public.reviews
  WHERE id = p_review_id AND parent_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR v_review.withdrawn_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'review_not_owned_or_withdrawn';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'withdraw_reason_required';
  END IF;
  UPDATE public.reviews SET withdrawn_at = now() WHERE id = p_review_id;
  PERFORM public.app_internal_audit(
    'review.withdraw', 'review', p_review_id, v_review.daycare_id, p_reason,
    jsonb_build_object('withdrawn_at', NULL), jsonb_build_object('withdrawn_at', now()),
    v_request_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.app_submit_review(uuid,integer,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_moderate_review(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_manager_submit_review_reply(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_moderate_review_reply(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_parent_withdraw_review(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_submit_review(uuid,integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_moderate_review(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_submit_review_reply(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_moderate_review_reply(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_parent_withdraw_review(uuid,text,text) TO authenticated;

COMMIT;
