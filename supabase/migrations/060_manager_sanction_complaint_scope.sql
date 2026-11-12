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
        WHERE m.user_id=auth.uid() AND m.member_role='manager' AND m.status='active' AND m.ended_at IS NULL
          AND public.app_is_daycare_manager(m.daycare_id))
      WHEN 'admin' THEN true
      ELSE false END
    ORDER BY c.created_at DESC LIMIT 200) q),'[]'::jsonb);
END;
$function$;

COMMIT;
