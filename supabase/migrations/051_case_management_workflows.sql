BEGIN;

-- The upload route needs a trusted daycare scope before storing a file. Only
-- an authorized pickup confirmer can resolve this scope.
CREATE OR REPLACE FUNCTION public.app_get_pickup_upload_scope(p_enrollment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_enrollment public.enrollments%ROWTYPE;
BEGIN
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id=p_enrollment_id;
  IF NOT FOUND OR NOT public.app_can_confirm_daycare_pickup(v_enrollment.daycare_id)
     OR v_enrollment.status<>'approved' OR v_enrollment.checked_in_at IS NULL
     OR v_enrollment.service_date>CURRENT_DATE THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='pickup_scope_required';
  END IF;
  RETURN jsonb_build_object('daycare_id',v_enrollment.daycare_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.app_get_pickup_upload_scope(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.app_get_pickup_upload_scope(uuid) TO authenticated;

-- Return the private path only to the authenticated API so it can create a
-- short-lived signed URL. The HTTP response never exposes the raw object path.
CREATE OR REPLACE FUNCTION public.app_list_enrollment_pickups(p_enrollment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_enrollment public.enrollments%ROWTYPE;
BEGIN
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id=p_enrollment_id;
  IF NOT FOUND OR (v_enrollment.parent_id<>auth.uid()
    AND NOT COALESCE(public.app_is_daycare_manager(v_enrollment.daycare_id),false)
    AND public.app_current_role() IS DISTINCT FROM 'admin') THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='enrollment_not_found';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,
    'collector',p.collector_snapshot,'verification_status',p.verification_status,
    'verification_note',p.verification_note,'verified_at',p.verified_at,
    'handed_over_at',p.handed_over_at,'late_minutes',p.late_minutes,
    'attachments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'mime_type',a.mime_type,
      'byte_size',a.byte_size,'path',a.object_path,'bucket',a.bucket) ORDER BY a.created_at)
      FROM public.attachments a WHERE a.pickup_id=p.id AND a.status='ready'),'[]'::jsonb))
    ORDER BY p.created_at) FROM public.pickup_records p WHERE p.enrollment_id=p_enrollment_id),'[]'::jsonb);
END;
$function$;
REVOKE ALL ON FUNCTION public.app_list_enrollment_pickups(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.app_list_enrollment_pickups(uuid) TO authenticated;

-- ---------------------------------------------------------------- complaints

CREATE OR REPLACE FUNCTION public.app_parent_create_complaint(
  p_category text,p_priority text,p_subject text,p_description text,
  p_enrollment_id uuid,p_incident_id uuid,p_daycare_id uuid,p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_id uuid;
  v_daycare_id uuid:=p_daycare_id;
  v_enrollment_id uuid:=p_enrollment_id;
  v_request_id text:=COALESCE(NULLIF(btrim(p_request_id),''),gen_random_uuid()::text);
  v_admin uuid;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='parent_account_not_active';
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('payment','daycare_service','caregiver_conduct','child_safety','account_access','other')
     OR p_priority IS NULL OR p_priority NOT IN ('low','medium','high','emergency')
     OR char_length(btrim(COALESCE(p_subject,''))) NOT BETWEEN 5 AND 160
     OR char_length(btrim(COALESCE(p_description,''))) NOT BETWEEN 20 AND 5000
     OR (p_category IN ('payment','daycare_service','caregiver_conduct','child_safety')
       AND p_daycare_id IS NULL AND p_enrollment_id IS NULL AND p_incident_id IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_complaint';
  END IF;
  IF p_incident_id IS NOT NULL THEN
    SELECT e.id,e.daycare_id INTO v_enrollment_id,v_daycare_id
    FROM public.incident_reports i JOIN public.enrollments e ON e.id=i.enrollment_id
    WHERE i.id=p_incident_id AND e.parent_id=auth.uid();
    IF NOT FOUND OR (p_enrollment_id IS NOT NULL AND p_enrollment_id<>v_enrollment_id)
       OR (p_daycare_id IS NOT NULL AND p_daycare_id<>v_daycare_id) THEN
      RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='complaint_reference_not_owned';
    END IF;
  ELSIF p_enrollment_id IS NOT NULL THEN
    SELECT e.daycare_id INTO v_daycare_id FROM public.enrollments e
    WHERE e.id=p_enrollment_id AND e.parent_id=auth.uid();
    IF NOT FOUND OR (p_daycare_id IS NOT NULL AND p_daycare_id<>v_daycare_id) THEN
      RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='complaint_reference_not_owned';
    END IF;
  ELSIF p_daycare_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.daycares d WHERE d.id=p_daycare_id AND d.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='complaint_reference_not_found';
  END IF;
  INSERT INTO public.complaints(submitted_by,daycare_id,enrollment_id,incident_id,
    category,priority,subject,description,status)
  VALUES(auth.uid(),v_daycare_id,v_enrollment_id,p_incident_id,p_category,p_priority,
    btrim(p_subject),btrim(p_description),'new') RETURNING id INTO v_id;
  INSERT INTO public.complaint_status_logs(complaint_id,from_status,to_status,actor_id,actor_type,reason)
  VALUES(v_id,NULL,'new',auth.uid(),'user','Complaint submitted');
  FOR v_admin IN SELECT id FROM public.users WHERE role='admin' AND status='active' AND deleted_at IS NULL LOOP
    PERFORM public.app_internal_notify(v_admin,'complaint_submitted','Laporan baru diterima',
      'Laporan baru menunggu peninjauan Admin.',p_priority,
      'complaint-submitted:'||v_id::text||':'||v_admin::text,NULL);
  END LOOP;
  PERFORM public.app_internal_audit('complaint.create','complaint',v_id,v_daycare_id,
    'Parent submitted complaint',NULL,jsonb_build_object('category',p_category,'priority',p_priority,'status','new'),v_request_id);
  RETURN jsonb_build_object('id',v_id,'status','new','created_at',now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_my_complaints()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text:=public.app_current_role();
BEGIN
  IF v_role NOT IN ('parent','manager','admin') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(item ORDER BY created_at DESC) FROM (
    SELECT c.created_at,jsonb_build_object('id',c.id,'daycare_id',c.daycare_id,
      'enrollment_id',c.enrollment_id,'incident_id',c.incident_id,'category',c.category,
      'priority',c.priority,'subject',c.subject,'description',c.description,'status',c.status,
      'resolution_text',CASE WHEN v_role='admin' OR c.submitted_by=auth.uid() THEN c.resolution_text END,
      'confirmation_due_at',c.confirmation_due_at,'created_at',c.created_at,'updated_at',c.updated_at,
      'status_logs',(SELECT COALESCE(jsonb_agg(jsonb_build_object('from_status',l.from_status,
        'to_status',l.to_status,'reason',l.reason,'response_text',l.response_text,'created_at',l.created_at)
        ORDER BY l.created_at),'[]'::jsonb) FROM public.complaint_status_logs l WHERE l.complaint_id=c.id)) item
    FROM public.complaints c
    WHERE CASE v_role WHEN 'parent' THEN c.submitted_by=auth.uid()
      WHEN 'manager' THEN c.daycare_id IN (SELECT daycare_id FROM public.daycare_members
        WHERE user_id=auth.uid() AND member_role='manager' AND status='active' AND ended_at IS NULL)
      ELSE true END
    ORDER BY c.created_at DESC LIMIT 200) q),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_list_complaints(p_status text DEFAULT NULL,p_priority text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('new','in_progress','waiting_for_response','waiting_for_confirmation','resolved','closed')
     OR p_priority IS NOT NULL AND p_priority NOT IN ('low','medium','high','emergency') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_complaint_filter';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(item ORDER BY priority_rank,created_at) FROM (
    SELECT CASE c.priority WHEN 'emergency' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END priority_rank,
      c.created_at,jsonb_build_object('id',c.id,'submitted_by',c.submitted_by,
      'submitter_name',u.full_name,'daycare_id',c.daycare_id,'daycare_name',d.name,
      'enrollment_id',c.enrollment_id,'incident_id',c.incident_id,'category',c.category,
      'priority',c.priority,'subject',c.subject,'description',c.description,'status',c.status,
      'assigned_admin_id',c.assigned_admin_id,'resolution_text',c.resolution_text,
      'confirmation_due_at',c.confirmation_due_at,'created_at',c.created_at,'updated_at',c.updated_at) item
    FROM public.complaints c JOIN public.users u ON u.id=c.submitted_by
    LEFT JOIN public.daycares d ON d.id=c.daycare_id
    WHERE (p_status IS NULL OR c.status=p_status) AND (p_priority IS NULL OR c.priority=p_priority)
    ORDER BY priority_rank,c.created_at LIMIT 200) q),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION private.app_record_admin_action(
  p_action_type text,p_complaint_id uuid,p_investigation_id uuid,p_reason text,p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_audit_id uuid;
BEGIN
  PERFORM public.app_internal_audit(p_action_type,
    CASE WHEN p_complaint_id IS NOT NULL THEN 'complaint' ELSE 'investigation' END,
    COALESCE(p_complaint_id,p_investigation_id),NULL,p_reason,NULL,
    jsonb_build_object('complaint_id',p_complaint_id,'investigation_id',p_investigation_id),p_request_id);
  SELECT id INTO v_audit_id FROM public.audit_logs
  WHERE request_id=COALESCE(NULLIF(btrim(p_request_id),''),'') AND actor_id=auth.uid()
    AND action=p_action_type ORDER BY created_at DESC LIMIT 1;
  IF v_audit_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='admin_action_audit_missing'; END IF;
  INSERT INTO public.admin_actions(admin_id,action_type,audit_log_id,complaint_id,investigation_id,decision_summary)
  VALUES(auth.uid(),p_action_type,v_audit_id,p_complaint_id,p_investigation_id,btrim(p_reason));
END;
$function$;
REVOKE ALL ON FUNCTION private.app_record_admin_action(text,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.app_admin_assign_complaint(p_complaint_id uuid,p_admin_id uuid,p_reason text,p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_complaint public.complaints%ROWTYPE;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed'; END IF;
  IF char_length(btrim(COALESCE(p_reason,'')))<5 OR NOT EXISTS(
    SELECT 1 FROM public.users WHERE id=p_admin_id AND role='admin' AND status='active' AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_complaint_assignment'; END IF;
  SELECT * INTO v_complaint FROM public.complaints WHERE id=p_complaint_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='complaint_not_found'; END IF;
  IF v_complaint.status IN ('resolved','closed') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='complaint_is_closed'; END IF;
  INSERT INTO public.complaint_assignments(complaint_id,from_admin_id,to_admin_id,changed_by,reason)
  VALUES(p_complaint_id,v_complaint.assigned_admin_id,p_admin_id,auth.uid(),btrim(p_reason));
  UPDATE public.complaints SET assigned_admin_id=p_admin_id,updated_at=now(),version=version+1 WHERE id=p_complaint_id;
  PERFORM private.app_record_admin_action('complaint.assign',p_complaint_id,NULL,p_reason,p_request_id);
  RETURN jsonb_build_object('complaint_id',p_complaint_id,'assigned_admin_id',p_admin_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_update_complaint(
  p_complaint_id uuid,p_action text,p_reason text,p_response_text text,p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_complaint public.complaints%ROWTYPE;
  v_role text:=public.app_current_role();
  v_next_status text;
  v_due timestamptz;
  v_response text:=NULLIF(btrim(COALESCE(p_response_text,'')),'');
BEGIN
  IF v_role NOT IN ('parent','admin') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed'; END IF;
  IF p_action NOT IN ('start','request_info','propose_resolution','respond','accept_resolution','reject_resolution')
     OR char_length(btrim(COALESCE(p_reason,'')))<5 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_complaint_action';
  END IF;
  SELECT * INTO v_complaint FROM public.complaints WHERE id=p_complaint_id FOR UPDATE;
  IF NOT FOUND OR (v_role='parent' AND v_complaint.submitted_by<>auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='complaint_not_found';
  END IF;
  IF v_complaint.status IN ('resolved','closed') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='complaint_is_closed'; END IF;
  IF v_role='admin' THEN
    IF p_action='start' AND v_complaint.status='new' THEN v_next_status:='in_progress';
    ELSIF p_action='request_info' AND v_complaint.status IN ('new','in_progress') AND v_response IS NOT NULL THEN v_next_status:='waiting_for_response';
    ELSIF p_action='propose_resolution' AND v_complaint.status IN ('in_progress','waiting_for_response') AND v_response IS NOT NULL THEN
      v_next_status:='waiting_for_confirmation'; v_due:=now()+interval '72 hours';
    ELSE RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='complaint_transition_not_allowed'; END IF;
    IF v_complaint.assigned_admin_id IS NOT NULL AND v_complaint.assigned_admin_id<>auth.uid() THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='complaint_assigned_to_another_admin';
    END IF;
  ELSE
    IF p_action='respond' AND v_complaint.status='waiting_for_response' AND v_response IS NOT NULL THEN v_next_status:='in_progress';
    ELSIF p_action='accept_resolution' AND v_complaint.status='waiting_for_confirmation' AND now()<=v_complaint.confirmation_due_at THEN v_next_status:='resolved';
    ELSIF p_action='reject_resolution' AND v_complaint.status='waiting_for_confirmation' AND now()<=v_complaint.confirmation_due_at AND v_response IS NOT NULL THEN v_next_status:='in_progress';
    ELSE RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='complaint_transition_not_allowed'; END IF;
  END IF;
  UPDATE public.complaints SET status=v_next_status,
    resolution_text=CASE WHEN p_action='propose_resolution' THEN v_response
      WHEN p_action='reject_resolution' THEN NULL ELSE resolution_text END,
    confirmation_requested_at=CASE WHEN p_action='propose_resolution' THEN now()
      WHEN p_action='reject_resolution' THEN NULL ELSE confirmation_requested_at END,
    confirmation_due_at=CASE WHEN p_action='propose_resolution' THEN v_due
      WHEN p_action='reject_resolution' THEN NULL ELSE confirmation_due_at END,
    confirmed_by=CASE WHEN p_action='accept_resolution' THEN auth.uid()
      WHEN p_action='reject_resolution' THEN NULL ELSE confirmed_by END,
    confirmed_at=CASE WHEN p_action='accept_resolution' THEN now()
      WHEN p_action='reject_resolution' THEN NULL ELSE confirmed_at END,
    updated_at=now(),version=version+1 WHERE id=p_complaint_id;
  INSERT INTO public.complaint_status_logs(complaint_id,from_status,to_status,actor_id,actor_type,reason,response_text)
  VALUES(p_complaint_id,v_complaint.status,v_next_status,auth.uid(),'user',btrim(p_reason),v_response);
  IF v_role='admin' THEN
    PERFORM private.app_record_admin_action('complaint.'||p_action,p_complaint_id,NULL,p_reason,p_request_id);
  ELSE
    PERFORM public.app_internal_audit('complaint.'||p_action,'complaint',p_complaint_id,
      v_complaint.daycare_id,p_reason,jsonb_build_object('status',v_complaint.status),
      jsonb_build_object('status',v_next_status),p_request_id);
  END IF;
  IF v_role='admin' THEN
    PERFORM public.app_internal_notify(v_complaint.submitted_by,'complaint_status_updated',
      'Pembaruan laporan',btrim(p_reason),'normal','complaint-status:'||p_complaint_id::text||':'||v_next_status||':'||v_complaint.version,NULL);
  END IF;
  RETURN jsonb_build_object('id',p_complaint_id,'status',v_next_status,'confirmation_due_at',v_due);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_system_close_unconfirmed_complaints(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.complaints%ROWTYPE; v_count integer:=0; v_request text:='complaint-timeout:'||gen_random_uuid()::text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed'; END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_expire_limit'; END IF;
  FOR v_row IN SELECT * FROM public.complaints WHERE status='waiting_for_confirmation'
    AND confirmation_due_at<=now() ORDER BY confirmation_due_at LIMIT p_limit FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.complaints SET status='closed',closed_at=now(),closure_reason='Auto-closed after 72-hour confirmation period',
      updated_at=now(),version=version+1 WHERE id=v_row.id;
    INSERT INTO public.complaint_status_logs(complaint_id,from_status,to_status,actor_type,reason)
    VALUES(v_row.id,'waiting_for_confirmation','closed','system','Auto-closed after 72-hour confirmation period');
    PERFORM public.app_internal_audit('complaint.auto_close','complaint',v_row.id,v_row.daycare_id,
      'No complainant response within 72 hours',jsonb_build_object('status',v_row.status),jsonb_build_object('status','closed'),v_request);
    v_count:=v_count+1;
  END LOOP;
  RETURN v_count;
END;
$function$;

-- ------------------------------------------------------------- investigations

CREATE OR REPLACE FUNCTION public.app_admin_create_investigation(
  p_complaint_id uuid,p_incident_id uuid,p_scope text,p_assigned_admin_id uuid,p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_id uuid; v_admin uuid:=COALESCE(p_assigned_admin_id,auth.uid());
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed'; END IF;
  IF (p_complaint_id IS NULL)=(p_incident_id IS NULL)
     OR char_length(btrim(COALESCE(p_scope,''))) NOT BETWEEN 10 AND 2000
     OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=v_admin AND role='admin' AND status='active' AND deleted_at IS NULL)
     OR (p_complaint_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.complaints WHERE id=p_complaint_id))
     OR (p_incident_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.incident_reports WHERE id=p_incident_id)) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_investigation';
  END IF;
  INSERT INTO public.investigations(complaint_id,incident_id,assigned_admin_id,status,scope)
  VALUES(p_complaint_id,p_incident_id,v_admin,'open',btrim(p_scope)) RETURNING id INTO v_id;
  PERFORM private.app_record_admin_action('investigation.create',p_complaint_id,v_id,p_scope,p_request_id);
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_list_investigations(p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed'; END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('open','in_progress','completed') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_investigation_status';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'complaint_id',i.complaint_id,
    'incident_id',i.incident_id,'assigned_admin_id',i.assigned_admin_id,'status',i.status,
    'scope',i.scope,'findings',i.findings,'recommendation',i.recommendation,
    'completed_at',i.completed_at,'created_at',i.created_at,'updated_at',i.updated_at)
    ORDER BY i.created_at DESC) FROM public.investigations i WHERE p_status IS NULL OR i.status=p_status),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_update_investigation(
  p_investigation_id uuid,p_status text,p_findings text,p_recommendation text,p_reason text,p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.investigations%ROWTYPE;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('open','in_progress','completed')
     OR char_length(btrim(COALESCE(p_reason,'')))<5
     OR char_length(COALESCE(p_findings,''))>10000 OR char_length(COALESCE(p_recommendation,''))>5000
     OR (p_status='completed' AND char_length(btrim(COALESCE(p_findings,'')))<10) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_investigation_update';
  END IF;
  SELECT * INTO v_row FROM public.investigations WHERE id=p_investigation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='investigation_not_found'; END IF;
  IF v_row.status='completed' AND p_status<>'completed' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='investigation_already_completed'; END IF;
  UPDATE public.investigations SET status=p_status,findings=NULLIF(btrim(COALESCE(p_findings,'')),''),
    recommendation=NULLIF(btrim(COALESCE(p_recommendation,'')),''),
    completed_at=CASE WHEN p_status='completed' THEN now() ELSE NULL END,updated_at=now()
    WHERE id=p_investigation_id;
  PERFORM private.app_record_admin_action('investigation.update',v_row.complaint_id,p_investigation_id,p_reason,p_request_id);
  RETURN jsonb_build_object('id',p_investigation_id,'status',p_status,'completed_at',CASE WHEN p_status='completed' THEN now() END);
END;
$function$;

-- ------------------------------------------------------------------- grants
REVOKE ALL ON FUNCTION public.app_parent_create_complaint(text,text,text,text,uuid,uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_list_my_complaints() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_admin_list_complaints(text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_admin_assign_complaint(uuid,uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_update_complaint(uuid,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_system_close_unconfirmed_complaints(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.app_admin_create_investigation(uuid,uuid,text,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_admin_list_investigations(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_admin_update_investigation(uuid,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.app_parent_create_complaint(text,text,text,text,uuid,uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_my_complaints() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_list_complaints(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_assign_complaint(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_update_complaint(uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_system_close_unconfirmed_complaints(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_admin_create_investigation(uuid,uuid,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_list_investigations(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_update_investigation(uuid,text,text,text,text,text) TO authenticated;

COMMIT;
