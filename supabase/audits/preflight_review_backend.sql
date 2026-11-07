DO $audit$
DECLARE v_missing text[];
BEGIN
  SELECT array_agg(name ORDER BY name) INTO v_missing
  FROM (VALUES
    ('public.reviews'), ('public.review_versions'),
    ('public.review_replies'), ('public.review_reply_versions')
  ) AS required(name)
  WHERE to_regclass(name) IS NULL;
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'Missing review tables: %', v_missing; END IF;

  SELECT array_agg(signature ORDER BY signature) INTO v_missing
  FROM (VALUES
    ('public.app_current_role()'), ('public.app_is_daycare_manager(uuid)'),
    ('public.app_internal_notify(uuid,text,text,text,text,text,uuid)'),
    ('public.app_internal_audit(text,text,uuid,uuid,text,jsonb,jsonb,text)')
  ) AS required(signature)
  WHERE to_regprocedure(signature) IS NULL;
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'Missing review helpers: %', v_missing; END IF;
END;
$audit$;
SELECT 'review_backend_preflight_passed' AS result, now() AS checked_at;
