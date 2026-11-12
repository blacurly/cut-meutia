BEGIN;

CREATE OR REPLACE FUNCTION public.app_parent_create_complaint(
  p_category text,p_priority text,p_subject text,p_description text,
  p_enrollment_id uuid,p_incident_id uuid,p_daycare_id uuid,p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_id uuid; v_daycare_id uuid:=p_daycare_id; v_enrollment_id uuid:=p_enrollment_id;
  v_request_id text:=COALESCE(NULLIF(btrim(p_request_id),''),gen_random_uuid()::text); v_admin uuid;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'parent' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='parent_account_not_active'; END IF;
  IF p_category IS NULL OR p_category NOT IN ('payment','daycare_service','caregiver_conduct','child_safety','account_access','other')
     OR p_priority IS NULL OR p_priority NOT IN ('low','medium','high','emergency')
     OR char_length(btrim(COALESCE(p_subject,''))) NOT BETWEEN 5 AND 160
     OR char_length(btrim(COALESCE(p_description,''))) NOT BETWEEN 20 AND 5000
     OR (p_category IN ('payment','daycare_service','caregiver_conduct','child_safety')
       AND p_daycare_id IS NULL AND p_enrollment_id IS NULL AND p_incident_id IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_complaint';
  END IF;
  IF p_incident_id IS NOT NULL THEN
    SELECT e.id,e.daycare_id INTO v_enrollment_id,v_daycare_id FROM public.incident_reports i
    JOIN public.enrollments e ON e.id=i.enrollment_id WHERE i.id=p_incident_id AND e.parent_id=auth.uid();
    IF NOT FOUND OR (p_enrollment_id IS NOT NULL AND p_enrollment_id<>v_enrollment_id)
      OR (p_daycare_id IS NOT NULL AND p_daycare_id<>v_daycare_id) THEN
      RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='complaint_reference_not_owned';
    END IF;
  ELSIF p_enrollment_id IS NOT NULL THEN
    SELECT e.daycare_id INTO v_daycare_id FROM public.enrollments e WHERE e.id=p_enrollment_id AND e.parent_id=auth.uid();
    IF NOT FOUND OR (p_daycare_id IS NOT NULL AND p_daycare_id<>v_daycare_id) THEN
      RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='complaint_reference_not_owned';
    END IF;
  ELSIF p_daycare_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.daycares d WHERE d.id=p_daycare_id AND d.deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='complaint_reference_not_found';
  END IF;
  INSERT INTO public.complaints(submitted_by,daycare_id,enrollment_id,incident_id,category,priority,subject,description,status)
  VALUES(auth.uid(),v_daycare_id,v_enrollment_id,p_incident_id,p_category,p_priority,btrim(p_subject),btrim(p_description),'new')
  RETURNING id INTO v_id;
  INSERT INTO public.complaint_status_logs(complaint_id,from_status,to_status,actor_id,actor_type,reason)
  VALUES(v_id,NULL,'new',auth.uid(),'user','Complaint submitted');
  FOR v_admin IN SELECT id FROM public.users WHERE role='admin' AND status='active' AND deleted_at IS NULL LOOP
    PERFORM public.app_internal_notify(v_admin,'complaint_submitted','Laporan baru diterima',
      'Laporan baru menunggu peninjauan Admin.',CASE WHEN p_priority IN ('emergency','high') THEN 'urgent' ELSE 'normal' END,
      'complaint-submitted:'||v_id::text||':'||v_admin::text,NULL);
  END LOOP;
  PERFORM public.app_internal_audit('complaint.create','complaint',v_id,v_daycare_id,
    'Parent submitted complaint',NULL,jsonb_build_object('category',p_category,'priority',p_priority,'status','new'),v_request_id);
  RETURN jsonb_build_object('id',v_id,'status','new','created_at',now());
END;
$function$;

COMMIT;
