BEGIN;

-- A reviewed child-focused copy is retained for the logbook; the original is
-- deleted from private Storage as soon as the reviewer approves that copy.
CREATE OR REPLACE FUNCTION private.app_can_delete_reviewed_logbook_original(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM public.attachments a
    JOIN public.attachment_variants v ON v.attachment_id=a.id
    JOIN public.daily_report_activities act ON act.id=a.activity_id
    JOIN public.daily_reports r ON r.id=act.report_id
    JOIN public.enrollments e ON e.id=r.enrollment_id
    WHERE a.bucket='logbook-originals' AND a.object_path=p_path
      AND a.status='ready' AND v.bucket='logbook-masked'
      AND v.variant_type='masked' AND v.status='ready'
      AND v.reviewed_by IS NOT NULL
      AND (
        public.app_current_role()='admin'
        OR public.app_is_daycare_manager(e.daycare_id)
        OR (a.uploaded_by=auth.uid() AND public.app_current_role()='caregiver')
      )
  ),false);
$function$;
REVOKE ALL ON FUNCTION private.app_can_delete_reviewed_logbook_original(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_delete_reviewed_logbook_original(text) TO authenticated;

CREATE POLICY logbook_originals_reviewed_cleanup ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='logbook-originals' AND private.app_can_delete_reviewed_logbook_original(name));

CREATE OR REPLACE FUNCTION public.app_review_activity_photo_variant(
  p_variant_id uuid,p_decision text,p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_variant public.attachment_variants%ROWTYPE;
  v_activity_id uuid; v_daycare_id uuid; v_original_path text;
  v_role text:=public.app_current_role();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='not_authenticated'; END IF;
  IF p_request_id IS NULL OR char_length(btrim(p_request_id)) NOT BETWEEN 12 AND 100
     OR p_decision IS NULL OR p_decision NOT IN ('ready','failed') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_photo_review';
  END IF;
  SELECT v.* INTO v_variant
  FROM public.attachment_variants v
  JOIN public.attachments a ON a.id=v.attachment_id
  JOIN public.daily_report_activities act ON act.id=a.activity_id
  WHERE v.id=p_variant_id AND v.bucket='logbook-masked'
    AND act.status='draft' AND act.deleted_at IS NULL
  FOR UPDATE OF v;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='photo_variant_not_found'; END IF;
  SELECT a.activity_id,e.daycare_id,a.object_path INTO v_activity_id,v_daycare_id,v_original_path
  FROM public.attachments a
  JOIN public.daily_report_activities act ON act.id=a.activity_id
  JOIN public.daily_reports r ON r.id=act.report_id
  JOIN public.enrollments e ON e.id=r.enrollment_id
  WHERE a.id=v_variant.attachment_id;
  IF NOT FOUND OR NOT (v_variant.status='processing'
       OR (v_variant.status='ready' AND p_decision='ready' AND v_variant.reviewed_by=auth.uid()))
     OR NOT (v_role='admin' OR public.app_is_daycare_manager(v_daycare_id)
       OR (v_role='caregiver' AND EXISTS(
         SELECT 1 FROM public.daily_report_activities a
         JOIN public.daily_reports r ON r.id=a.report_id
         WHERE a.id=v_activity_id AND a.caregiver_id=auth.uid()
           AND public.app_is_current_assigned_caregiver(r.enrollment_id)))) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='photo_review_scope_required';
  END IF;
  IF v_variant.status='processing' THEN
    UPDATE public.attachment_variants
    SET status=p_decision,reviewed_by=auth.uid(),reviewed_at=now()
    WHERE id=p_variant_id;
    PERFORM public.app_internal_audit('logbook.photo.review','attachment_variant',p_variant_id,v_daycare_id,
      'Authorized staff reviewed child-focused logbook photo',
      jsonb_build_object('status',v_variant.status),
      jsonb_build_object('status',p_decision,'activity_id',v_activity_id),p_request_id);
  END IF;
  RETURN jsonb_build_object('id',p_variant_id,'status',p_decision,
    'reviewed_at',COALESCE(v_variant.reviewed_at,now()),
    'original_path',CASE WHEN p_decision='ready' THEN v_original_path ELSE NULL END);
END;
$function$;

COMMIT;