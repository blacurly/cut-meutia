-- Run after migration 039 and the seed. Read-only checks.
DO $audit$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.daycare_listings'::regclass) THEN
    RAISE EXCEPTION 'RLS must be enabled on public.daycare_listings.';
  END IF;
  IF NOT has_table_privilege('anon', 'public.daycare_listings', 'SELECT') THEN
    RAISE EXCEPTION 'anon must be able to read the public catalog.';
  END IF;
  IF has_table_privilege('anon', 'public.daycare_listings', 'INSERT')
     OR has_table_privilege('anon', 'public.daycare_listings', 'UPDATE')
     OR has_table_privilege('anon', 'public.daycare_listings', 'DELETE')
     OR has_table_privilege('authenticated', 'public.daycare_listings', 'INSERT')
     OR has_table_privilege('authenticated', 'public.daycare_listings', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.daycare_listings', 'DELETE') THEN
    RAISE EXCEPTION 'Browser roles must not write public.daycare_listings.';
  END IF;
END;
$audit$;

SELECT province_name, count(*) AS listings,
       count(*) FILTER (WHERE legal_status = 'referenced') AS with_legal_reference,
       count(public_rating) AS with_rating
FROM public.daycare_listings
GROUP BY province_name
ORDER BY province_name;
