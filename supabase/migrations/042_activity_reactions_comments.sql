-- Logbook interaction: "love" reactions and comments on daily activities.
--
-- Visibility follows the logbook itself (036/040): only SENT, non-deleted
-- activities of an approved/completed enrollment, and only for
--   * the enrollment's parent,
--   * a manager of the daycare,
--   * the currently assigned caregiver.
-- Only the parent may give a love reaction. Parent, manager and caregiver may
-- comment. Writes go through SECURITY DEFINER RPCs; the tables are read-only
-- for the Data API (RLS on, SELECT policy mirrors the rules above).

BEGIN;

-- --------------------------------------------------------------- viewer role

CREATE OR REPLACE FUNCTION public.app_activity_viewer_role(p_activity_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_parent_id uuid;
  v_daycare_id uuid;
  v_enrollment_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_activity_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT e.parent_id, e.daycare_id, e.id
    INTO v_parent_id, v_daycare_id, v_enrollment_id
  FROM public.daily_report_activities AS a
  JOIN public.daily_reports AS r ON r.id = a.report_id
  JOIN public.enrollments AS e ON e.id = r.enrollment_id
  WHERE a.id = p_activity_id
    AND a.deleted_at IS NULL
    AND a.status = 'sent'
    AND e.status IN ('approved', 'completed');
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_parent_id = auth.uid() AND public.app_current_role() IS NOT DISTINCT FROM 'parent' THEN
    RETURN 'parent';
  END IF;
  IF COALESCE(public.app_is_daycare_manager(v_daycare_id), false) THEN
    RETURN 'manager';
  END IF;
  IF COALESCE(public.app_is_current_assigned_caregiver(v_enrollment_id), false) THEN
    RETURN 'caregiver';
  END IF;
  RETURN NULL;
END;
$function$;

-- ------------------------------------------------------------------- tables

CREATE TABLE public.activity_reactions (
  activity_id uuid NOT NULL REFERENCES public.daily_report_activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction text NOT NULL DEFAULT 'love' CHECK (reaction IN ('love')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, user_id, reaction)
);

CREATE TABLE public.activity_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.daily_report_activities(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  author_role text NOT NULL CHECK (author_role IN ('parent', 'manager', 'caregiver')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (author_id, request_id)
);

CREATE INDEX activity_comments_activity_idx ON public.activity_comments (activity_id, created_at);

ALTER TABLE public.activity_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_reactions_viewer_read
  ON public.activity_reactions
  FOR SELECT
  TO authenticated
  USING (public.app_activity_viewer_role(activity_id) IS NOT NULL);

CREATE POLICY activity_comments_viewer_read
  ON public.activity_comments
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND public.app_activity_viewer_role(activity_id) IS NOT NULL);

REVOKE ALL ON TABLE public.activity_reactions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.activity_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.activity_reactions TO authenticated;
GRANT SELECT ON TABLE public.activity_comments TO authenticated;

-- ---------------------------------------------------------------- reactions

CREATE OR REPLACE FUNCTION public.app_set_activity_reaction(
  p_activity_id uuid,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_caregiver_id uuid;
  v_enrollment_id uuid;
  v_title text;
  v_inserted integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;
  IF p_active IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_reaction_state';
  END IF;
  v_role := public.app_activity_viewer_role(p_activity_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'activity_not_found';
  END IF;
  IF v_role <> 'parent' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'reaction_not_allowed';
  END IF;

  IF p_active THEN
    INSERT INTO public.activity_reactions (activity_id, user_id, reaction)
    VALUES (p_activity_id, auth.uid(), 'love')
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted > 0 THEN
      SELECT a.caregiver_id, r.enrollment_id, a.title
        INTO v_caregiver_id, v_enrollment_id, v_title
      FROM public.daily_report_activities AS a
      JOIN public.daily_reports AS r ON r.id = a.report_id
      WHERE a.id = p_activity_id;
      -- One notification per activity, even if the parent toggles again.
      PERFORM public.app_internal_notify(
        v_caregiver_id, 'daily_activity_loved', 'Orang tua menyukai catatan Anda',
        'Catatan "' || left(v_title, 80) || '" mendapat tanda suka dari orang tua.',
        'normal', 'activity-love:' || p_activity_id::text, v_enrollment_id
      );
    END IF;
  ELSE
    DELETE FROM public.activity_reactions
    WHERE activity_id = p_activity_id AND user_id = auth.uid() AND reaction = 'love';
  END IF;

  RETURN jsonb_build_object(
    'activity_id', p_activity_id,
    'loved_by_me', p_active,
    'love_count', (SELECT count(*) FROM public.activity_reactions
                   WHERE activity_id = p_activity_id AND reaction = 'love')
  );
END;
$function$;

-- ----------------------------------------------------------------- comments

CREATE OR REPLACE FUNCTION public.app_internal_activity_comment_json(p_comment_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT jsonb_build_object(
    'id', c.id, 'activity_id', c.activity_id, 'body', c.body,
    'author_role', c.author_role, 'author_name', u.full_name,
    'is_mine', c.author_id = auth.uid(), 'created_at', c.created_at)
  FROM public.activity_comments AS c
  JOIN public.users AS u ON u.id = c.author_id
  WHERE c.id = p_comment_id;
$function$;

CREATE OR REPLACE FUNCTION public.app_add_activity_comment(
  p_activity_id uuid,
  p_body text,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
  v_comment_id uuid;
  v_caregiver_id uuid;
  v_parent_id uuid;
  v_enrollment_id uuid;
  v_recipient_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;
  v_role := public.app_activity_viewer_role(p_activity_id);
  IF v_role IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'activity_not_found';
  END IF;
  IF p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_comment_body';
  END IF;
  IF char_length(v_request_id) > 100 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_request_id';
  END IF;

  INSERT INTO public.activity_comments (activity_id, author_id, author_role, body, request_id)
  VALUES (p_activity_id, auth.uid(), v_role, btrim(p_body), v_request_id)
  ON CONFLICT (author_id, request_id) DO NOTHING
  RETURNING id INTO v_comment_id;

  IF v_comment_id IS NULL THEN
    -- Retried request: return the comment created the first time.
    SELECT id INTO v_comment_id FROM public.activity_comments
    WHERE author_id = auth.uid() AND request_id = v_request_id AND activity_id = p_activity_id;
    IF v_comment_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_request_id';
    END IF;
    RETURN public.app_internal_activity_comment_json(v_comment_id);
  END IF;

  SELECT a.caregiver_id, e.parent_id, e.id
    INTO v_caregiver_id, v_parent_id, v_enrollment_id
  FROM public.daily_report_activities AS a
  JOIN public.daily_reports AS r ON r.id = a.report_id
  JOIN public.enrollments AS e ON e.id = r.enrollment_id
  WHERE a.id = p_activity_id;

  v_recipient_id := CASE WHEN v_role = 'parent' THEN v_caregiver_id ELSE v_parent_id END;
  IF v_recipient_id IS DISTINCT FROM auth.uid() THEN
    PERFORM public.app_internal_notify(
      v_recipient_id, 'daily_activity_comment',
      CASE WHEN v_role = 'parent' THEN 'Komentar baru dari orang tua'
           ELSE 'Balasan baru di catatan harian' END,
      left(btrim(p_body), 140), 'normal',
      'activity-comment:' || v_comment_id::text || ':' || v_recipient_id::text,
      v_enrollment_id
    );
  END IF;

  RETURN public.app_internal_activity_comment_json(v_comment_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_delete_activity_comment(p_comment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_comment public.activity_comments%ROWTYPE;
BEGIN
  SELECT * INTO v_comment FROM public.activity_comments
  WHERE id = p_comment_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR public.app_activity_viewer_role(v_comment.activity_id) IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'comment_not_found';
  END IF;
  IF v_comment.author_id <> auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'comment_delete_not_allowed';
  END IF;
  UPDATE public.activity_comments SET deleted_at = now() WHERE id = p_comment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_activity_comments(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF public.app_activity_viewer_role(p_activity_id) IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'activity_not_found';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(public.app_internal_activity_comment_json(c.id) ORDER BY c.created_at)
    FROM public.activity_comments AS c
    WHERE c.activity_id = p_activity_id AND c.deleted_at IS NULL
  ), '[]'::jsonb);
END;
$function$;

-- -------------------------------------- logbook list with interaction counts
-- Same rules as 040; adds love_count, loved_by_me and comment_count.

CREATE OR REPLACE FUNCTION public.app_list_daily_activities(p_enrollment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_own_only boolean := false;
BEGIN
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = p_enrollment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'enrollment_not_found';
  END IF;
  IF v_enrollment.parent_id = auth.uid()
     OR COALESCE(public.app_is_daycare_manager(v_enrollment.daycare_id), false) THEN
    v_own_only := false;  -- sent activities only
  ELSIF COALESCE(public.app_is_current_assigned_caregiver(v_enrollment.id), false) THEN
    v_own_only := true;   -- the caregiver's own drafts and sent activities
  ELSE
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'enrollment_not_found';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', a.id, 'report_date', r.report_date, 'activity_type', a.activity_type,
      'title', a.title, 'body', a.body, 'occurred_at', a.occurred_at, 'status', a.status,
      'is_urgent', a.is_urgent, 'urgent_reason', a.urgent_reason, 'sent_at', a.sent_at,
      'version', a.version, 'caregiver_name', u.full_name,
      'parent_read_at', (SELECT k.acknowledged_at FROM public.activity_acknowledgements AS k
                         WHERE k.activity_id = a.id AND k.ack_type = 'parent_read'),
      'love_count', (SELECT count(*) FROM public.activity_reactions AS x
                     WHERE x.activity_id = a.id AND x.reaction = 'love'),
      'loved_by_me', EXISTS (SELECT 1 FROM public.activity_reactions AS x
                             WHERE x.activity_id = a.id AND x.user_id = auth.uid()),
      'comment_count', (SELECT count(*) FROM public.activity_comments AS c
                        WHERE c.activity_id = a.id AND c.deleted_at IS NULL))
      ORDER BY a.occurred_at DESC)
    FROM public.daily_report_activities AS a
    JOIN public.daily_reports AS r ON r.id = a.report_id
    JOIN public.users AS u ON u.id = a.caregiver_id
    WHERE r.enrollment_id = v_enrollment.id
      AND a.deleted_at IS NULL
      AND (CASE WHEN v_own_only THEN a.caregiver_id = auth.uid() ELSE a.status = 'sent' END)
  ), '[]'::jsonb);
END;
$function$;

-- ------------------------------------------------------------------- grants

REVOKE ALL ON FUNCTION public.app_activity_viewer_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_internal_activity_comment_json(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_set_activity_reaction(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_add_activity_comment(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_delete_activity_comment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_list_activity_comments(uuid) FROM PUBLIC, anon;

-- The viewer-role helper is used inside RLS policies, so the caller role
-- needs EXECUTE on it.
GRANT EXECUTE ON FUNCTION public.app_activity_viewer_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_set_activity_reaction(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_add_activity_comment(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_delete_activity_comment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_activity_comments(uuid) TO authenticated;

COMMIT;
