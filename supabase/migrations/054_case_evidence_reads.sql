BEGIN;

CREATE OR REPLACE FUNCTION public.app_list_complaint_evidence(p_complaint_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_complaint public.complaints%ROWTYPE; v_role text:=public.app_current_role();
BEGIN
  SELECT * INTO v_complaint FROM public.complaints WHERE id=p_complaint_id;
  IF NOT FOUND OR NOT (v_role='admin' OR v_complaint.submitted_by=auth.uid()
    OR (v_complaint.daycare_id IS NOT NULL AND public.app_is_daycare_manager(v_complaint.daycare_id))) THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='complaint_not_found';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'path',a.object_path,
    'bucket',a.bucket,'mime_type',a.mime_type,'byte_size',a.byte_size) ORDER BY a.created_at)
    FROM public.attachments a WHERE a.complaint_id=p_complaint_id AND a.status='ready'),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_list_investigation_evidence(p_investigation_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' OR NOT EXISTS(
    SELECT 1 FROM public.investigations WHERE id=p_investigation_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='investigation_not_found';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'path',a.object_path,
    'bucket',a.bucket,'mime_type',a.mime_type,'byte_size',a.byte_size) ORDER BY a.created_at)
    FROM public.attachments a WHERE a.investigation_id=p_investigation_id AND a.status='ready'),'[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.app_list_complaint_evidence(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_admin_list_investigation_evidence(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.app_list_complaint_evidence(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_list_investigation_evidence(uuid) TO authenticated;

COMMIT;
