BEGIN;

-- Public partner listings expose only catalog-safe fields. Keep the full
-- daycares table private to the manager path; do not grant table-wide reads
-- to authenticated users to make the catalog work.
DROP POLICY IF EXISTS daycares_specific_user_read ON public.daycares;

CREATE OR REPLACE FUNCTION public.app_list_public_daycares()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'slug', d.slug,
        'name', d.name,
        'description', d.description,
        'address', d.address,
        'province_code', d.province_code,
        'city_code', d.city_code,
        'district_code', d.district_code,
        'facilities', d.facilities,
        'daily_capacity', d.daily_capacity,
        'status', d.status
      ) ORDER BY d.name, d.id
    ),
    '[]'::jsonb
  )
  FROM public.daycares AS d
  WHERE d.status = 'active'
    AND d.deleted_at IS NULL;
$function$;

CREATE OR REPLACE FUNCTION public.app_get_public_daycare(
  p_daycare_id uuid DEFAULT NULL,
  p_slug text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT jsonb_build_object(
    'id', d.id,
    'slug', d.slug,
    'name', d.name,
    'description', d.description,
    'address', d.address,
    'province_code', d.province_code,
    'city_code', d.city_code,
    'district_code', d.district_code,
    'facilities', d.facilities,
    'daily_capacity', d.daily_capacity,
    'status', d.status
  )
  FROM public.daycares AS d
  WHERE ((p_daycare_id IS NOT NULL AND p_slug IS NULL AND d.id = p_daycare_id)
      OR (p_daycare_id IS NULL AND p_slug IS NOT NULL AND d.slug = p_slug))
    AND d.status = 'active'
    AND d.deleted_at IS NULL
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.app_list_public_daycares() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.app_get_public_daycare(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_list_public_daycares() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_public_daycare(uuid, text) TO anon, authenticated;

COMMIT;
