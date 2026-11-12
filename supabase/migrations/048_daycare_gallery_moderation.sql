BEGIN;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('daycare-gallery','daycare-gallery',false,8388608,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=8388608,
  allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];

CREATE TABLE public.daycare_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daycare_id uuid NOT NULL REFERENCES public.daycares(id) ON DELETE RESTRICT,
  object_path text NOT NULL UNIQUE,
  caption text,
  display_order smallint NOT NULL DEFAULT 0 CHECK(display_order BETWEEN 0 AND 99),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','archived')),
  submitted_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,daycare_id)
);
CREATE INDEX daycare_photos_public_idx ON public.daycare_photos(daycare_id,display_order,created_at)
  WHERE status='approved';
ALTER TABLE public.daycare_photos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.app_can_read_daycare_gallery_object(p_bucket text,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT p_bucket='daycare-gallery' AND EXISTS(
    SELECT 1 FROM public.daycare_photos p JOIN public.daycares d ON d.id=p.daycare_id
    WHERE p.object_path=p_path AND p.status='approved' AND d.status='active' AND d.deleted_at IS NULL
  );
$function$;

CREATE POLICY daycare_gallery_approved_public_read ON storage.objects
  FOR SELECT TO anon,authenticated
  USING(bucket_id='daycare-gallery' AND public.app_can_read_daycare_gallery_object(bucket_id,name));
CREATE POLICY daycare_gallery_staff_preview ON storage.objects
  FOR SELECT TO authenticated
  USING(bucket_id='daycare-gallery' AND (public.app_current_role()='admin' OR CASE
    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN public.app_is_daycare_manager(((storage.foldername(name))[1])::uuid) ELSE false END));
CREATE POLICY daycare_gallery_manager_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK(bucket_id='daycare-gallery' AND CASE
    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN public.app_is_daycare_manager(((storage.foldername(name))[1])::uuid) ELSE false END);
CREATE POLICY daycare_gallery_manager_remove_pending ON storage.objects
  FOR DELETE TO authenticated USING(bucket_id='daycare-gallery' AND CASE
    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN public.app_is_daycare_manager(((storage.foldername(name))[1])::uuid) ELSE false END
    AND EXISTS(SELECT 1 FROM public.daycare_photos p WHERE p.object_path=name AND p.status IN ('pending','rejected')));

CREATE OR REPLACE FUNCTION public.app_manager_list_daycare_photos(p_daycare_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id),false) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='manager_scope_required';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'path',object_path,'caption',caption,
    'display_order',display_order,'status',status,'decision_reason',decision_reason,
    'created_at',created_at) ORDER BY display_order,created_at DESC)
    FROM public.daycare_photos WHERE daycare_id=p_daycare_id AND status<>'archived'),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_submit_daycare_photo(
  p_daycare_id uuid,p_object_path text,p_caption text,p_request_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id),false) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='manager_scope_required';
  END IF;
  IF p_object_path IS NULL OR p_object_path NOT LIKE p_daycare_id::text||'/%'
     OR (p_caption IS NOT NULL AND char_length(p_caption)>160) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_daycare_photo';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='daycare-gallery' AND name=p_object_path) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_daycare_photo';
  END IF;
  IF (SELECT count(*) FROM public.daycare_photos WHERE daycare_id=p_daycare_id AND status IN ('pending','approved'))>=20 THEN
    RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='daycare_photo_limit_reached';
  END IF;
  INSERT INTO public.daycare_photos(daycare_id,object_path,caption,submitted_by)
  VALUES(p_daycare_id,p_object_path,NULLIF(btrim(p_caption),''),auth.uid()) RETURNING id INTO v_id;
  PERFORM public.app_internal_audit('daycare_photo.submit','daycare_photo',v_id,p_daycare_id,
    NULL,NULL,jsonb_build_object('status','pending'),p_request_id);
  RETURN jsonb_build_object('id',v_id,'status','pending');
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_list_pending_daycare_photos()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'path',p.object_path,'caption',p.caption,
    'created_at',p.created_at,'daycare',jsonb_build_object('id',d.id,'name',d.name),
    'manager',jsonb_build_object('id',u.id,'full_name',u.full_name)) ORDER BY p.created_at)
    FROM public.daycare_photos p JOIN public.daycares d ON d.id=p.daycare_id
    JOIN public.users u ON u.id=p.submitted_by WHERE p.status='pending'),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_decide_daycare_photo(
  p_photo_id uuid,p_decision text,p_reason text,p_request_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_photo public.daycare_photos%ROWTYPE;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected')
     OR char_length(btrim(COALESCE(p_reason,'')))<5 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_photo_decision';
  END IF;
  SELECT * INTO v_photo FROM public.daycare_photos WHERE id=p_photo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='daycare_photo_not_found'; END IF;
  IF v_photo.status<>'pending' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='daycare_photo_not_pending'; END IF;
  UPDATE public.daycare_photos SET status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),
    decision_reason=btrim(p_reason),updated_at=now() WHERE id=p_photo_id;
  PERFORM public.app_internal_audit('daycare_photo.decide','daycare_photo',p_photo_id,
    v_photo.daycare_id,p_reason,jsonb_build_object('status','pending'),
    jsonb_build_object('status',p_decision),p_request_id);
  RETURN jsonb_build_object('photo_id',p_photo_id,'decision',p_decision);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_public_daycare_photos(p_daycare_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('path',p.object_path,
    'caption',p.caption,'display_order',p.display_order) ORDER BY p.display_order,p.created_at)
    FROM public.daycare_photos p JOIN public.daycares d ON d.id=p.daycare_id
    WHERE p.daycare_id=p_daycare_id AND p.status='approved'
      AND d.status='active' AND d.deleted_at IS NULL),'[]'::jsonb);
$function$;

REVOKE ALL ON FUNCTION public.app_can_read_daycare_gallery_object(text,text) FROM PUBLIC,authenticated;
REVOKE ALL ON FUNCTION public.app_manager_list_daycare_photos(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_manager_submit_daycare_photo(uuid,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_admin_list_pending_daycare_photos() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_admin_decide_daycare_photo(uuid,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_list_public_daycare_photos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_can_read_daycare_gallery_object(text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_list_daycare_photos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_submit_daycare_photo(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_list_pending_daycare_photos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_decide_daycare_photo(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_public_daycare_photos(uuid) TO anon,authenticated;

COMMIT;
