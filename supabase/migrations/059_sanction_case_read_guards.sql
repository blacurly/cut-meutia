BEGIN;

CREATE OR REPLACE FUNCTION public.app_list_my_complaints()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text:=public.app_current_role();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('parent','manager','admin') THEN
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
    WHERE CASE v_role
      WHEN 'parent' THEN c.submitted_by=auth.uid()
      WHEN 'manager' THEN c.daycare_id IN (SELECT m.daycare_id FROM public.daycare_members m
        WHERE m.user_id=auth.uid() AND m.member_role='manager' AND m.status='active' AND m.ended_at IS NULL)
      WHEN 'admin' THEN true
      ELSE false END
    ORDER BY c.created_at DESC LIMIT 200) q),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_complaint_evidence(p_complaint_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_complaint public.complaints%ROWTYPE; v_role text:=public.app_current_role();
BEGIN
  SELECT * INTO v_complaint FROM public.complaints WHERE id=p_complaint_id;
  IF NOT FOUND OR NOT (v_role='admin' OR (v_role='parent' AND v_complaint.submitted_by=auth.uid())
    OR (v_role='manager' AND v_complaint.daycare_id IS NOT NULL
      AND public.app_is_daycare_manager(v_complaint.daycare_id))) THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='complaint_not_found';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'path',a.object_path,
    'bucket',a.bucket,'mime_type',a.mime_type,'byte_size',a.byte_size) ORDER BY a.created_at)
    FROM public.attachments a WHERE a.complaint_id=p_complaint_id AND a.status='ready'),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION private.app_can_read_case_evidence(p_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_kind text:=split_part(p_path,'/',1); v_id uuid; v_role text:=public.app_current_role();
BEGIN
  IF split_part(p_path,'/',2) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
  v_id:=split_part(p_path,'/',2)::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.attachments a WHERE a.bucket='case-evidence'
    AND a.object_path=p_path AND a.status='ready') THEN RETURN false; END IF;
  IF v_role='admin' THEN RETURN true; END IF;
  IF v_kind='complaints' THEN RETURN EXISTS(SELECT 1 FROM public.complaints c WHERE c.id=v_id
    AND ((v_role='parent' AND c.submitted_by=auth.uid())
      OR (v_role='manager' AND c.daycare_id IS NOT NULL AND public.app_is_daycare_manager(c.daycare_id)))); END IF;
  RETURN false;
END;
$function$;
REVOKE ALL ON FUNCTION private.app_can_read_case_evidence(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_read_case_evidence(text) TO authenticated;

COMMIT;
