-- Read-only structural verification for logbook and incident media migrations.
WITH checks AS (
  SELECT 'private_media_buckets_and_limits'::text AS check_name,
    count(*)=3 AND bool_and(NOT public) AND bool_and(file_size_limit=CASE id
      WHEN 'logbook-originals' THEN 4194304
      WHEN 'logbook-masked' THEN 8388608
      WHEN 'incident-evidence' THEN 10485760 END)
      AND bool_and(allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp']::text[]) AS passed,
    string_agg(id||': private='||(NOT public)::text||', limit='||file_size_limit, '; ' ORDER BY id) AS details
  FROM storage.buckets
  WHERE id IN ('logbook-originals','logbook-masked','incident-evidence')
  UNION ALL
  SELECT 'required_storage_policies',
    count(*)=10,
    string_agg(policyname, ', ' ORDER BY policyname)
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND policyname IN (
      'logbook_originals_scoped_upload','logbook_originals_orphan_cleanup','logbook_originals_reviewed_cleanup',
      'logbook_variants_scoped_upload','logbook_variants_staff_review_read','logbook_variants_orphan_cleanup',
      'incident_evidence_scoped_upload','incident_evidence_orphan_cleanup',
      'parent_read_ready_logbook_masked','parent_manager_admin_read_incident_evidence')
  UNION ALL
  SELECT 'authenticated_media_rpcs_only',
    bool_and(has_function_privilege('authenticated',p.signature,'EXECUTE'))
      AND bool_and(NOT has_function_privilege('anon',p.signature,'EXECUTE')),
    string_agg(p.signature::text, ', ' ORDER BY p.signature::text)
  FROM (VALUES
    ('public.app_record_activity_photo(uuid,uuid,text,text,bigint,text,text,text,text,jsonb,text)'::regprocedure),
    ('public.app_review_activity_photo_variant(uuid,text,text)'::regprocedure),
    ('public.app_list_activity_photos(uuid)'::regprocedure),
    ('public.app_attach_incident_evidence(uuid,text,text,bigint,text,text)'::regprocedure),
    ('public.app_list_incident_evidence(uuid)'::regprocedure)
  ) AS p(signature)
  UNION ALL
  SELECT 'normal_logbook_requires_reviewed_photos',
    EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid='public.daily_report_activities'::regclass
        AND tgname='daily_activity_requires_ready_photos' AND NOT tgisinternal),
    'trigger daily_activity_requires_ready_photos'
  UNION ALL
  SELECT 'original_bucket_has_no_read_policy',
    NOT EXISTS (SELECT 1 FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects' AND cmd='SELECT'
        AND coalesce(qual,'') LIKE '%logbook-originals%'),
    'raw original remains unreadable through Storage RLS'
)
SELECT check_name, passed, details FROM checks ORDER BY check_name;