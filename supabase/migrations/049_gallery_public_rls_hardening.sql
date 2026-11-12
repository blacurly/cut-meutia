BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon,authenticated;

CREATE OR REPLACE FUNCTION private.app_gallery_daycare_is_active(p_daycare_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.daycares d WHERE d.id=p_daycare_id
    AND d.status='active' AND d.deleted_at IS NULL);
$function$;

CREATE OR REPLACE FUNCTION private.app_gallery_object_is_public(p_bucket text,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT p_bucket='daycare-gallery' AND EXISTS(
    SELECT 1 FROM public.daycare_photos p JOIN public.daycares d ON d.id=p.daycare_id
    WHERE p.object_path=p_path AND p.status='approved' AND d.status='active' AND d.deleted_at IS NULL
  );
$function$;
REVOKE ALL ON FUNCTION private.app_gallery_daycare_is_active(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.app_gallery_object_is_public(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.app_gallery_daycare_is_active(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION private.app_gallery_object_is_public(text,text) TO anon,authenticated;

GRANT SELECT(id,daycare_id,object_path,caption,display_order,status,created_at)
  ON public.daycare_photos TO anon,authenticated;
CREATE POLICY daycare_photos_public_approved_read ON public.daycare_photos
  FOR SELECT TO anon,authenticated USING(status='approved' AND private.app_gallery_daycare_is_active(daycare_id));

DROP POLICY daycare_gallery_approved_public_read ON storage.objects;
CREATE POLICY daycare_gallery_approved_public_read ON storage.objects
  FOR SELECT TO anon,authenticated USING(
    bucket_id='daycare-gallery' AND private.app_gallery_object_is_public(bucket_id,name)
  );
DROP FUNCTION public.app_can_read_daycare_gallery_object(text,text);

CREATE OR REPLACE FUNCTION public.app_list_public_daycare_photos(p_daycare_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $function$
  SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('path',p.object_path,
    'caption',p.caption,'display_order',p.display_order) ORDER BY p.display_order,p.created_at)
    FROM public.daycare_photos p WHERE p.daycare_id=p_daycare_id),'[]'::jsonb);
$function$;

COMMIT;
