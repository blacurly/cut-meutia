-- End-to-end test of the non-AI backend against the real schema and RLS.
-- Runs the whole flow with temporary accounts and ROLLBACKs at the end, so no
-- data is left behind. Run as the postgres role (SQL Editor or psql).
-- A failed assertion aborts with its message; success ends with 'E2E OK'.
--
-- Covered: child CRUD rules, enrollment, manager decision + capacity, payment,
-- caregiver assignment, check-in, daily log + love + comments, incident, completion, review +
-- moderation + reply, notifications, expiry job, and cross-account isolation.

BEGIN;

-- ------------------------------------------------------------------ fixtures
DO $setup$
DECLARE
  v_role text;
  v_id uuid;
  v_daycare uuid;
  v_offering uuid;
  v_price uuid;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['parent', 'parent2', 'manager', 'caregiver', 'admin'] LOOP
    v_id := gen_random_uuid();
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, raw_user_meta_data)
    VALUES (v_id, 'authenticated', 'authenticated', 'e2e-' || v_role || '-' || v_id || '@example.invalid',
            now(), jsonb_build_object('full_name', 'E2E ' || v_role));
    PERFORM set_config('e2e.' || v_role, v_id::text, true);
  END LOOP;
  -- Signup always creates a Parent; staff roles are provisioned server-side.
  UPDATE public.users SET role = 'manager' WHERE id = current_setting('e2e.manager')::uuid;
  UPDATE public.users SET role = 'caregiver' WHERE id = current_setting('e2e.caregiver')::uuid;
  UPDATE public.users SET role = 'admin' WHERE id = current_setting('e2e.admin')::uuid;

  INSERT INTO public.daycares (slug, name, description, address, province_code, city_code, district_code,
    timezone, contact_phone, facilities, opening_hours, public_gallery, daily_capacity, status, main_manager_id)
  VALUES ('e2e-' || left(md5(random()::text), 10), 'E2E Daycare', 'Daycare untuk uji otomatis', 'Jl. Uji No. 1',
    '35', '3578', '357801', 'Asia/Jakarta', '081200000000', '[]', '{}', '[]', 1, 'active',
    current_setting('e2e.manager')::uuid)
  RETURNING id INTO v_daycare;
  INSERT INTO public.daycare_members (daycare_id, user_id, member_role, status) VALUES
    (v_daycare, current_setting('e2e.manager')::uuid, 'manager', 'active'),
    (v_daycare, current_setting('e2e.caregiver')::uuid, 'caregiver', 'active');
  INSERT INTO public.service_offerings (daycare_id, name, service_type, description, min_age_months, max_age_months, is_active)
  VALUES (v_daycare, 'Penitipan harian', 'daily', 'Layanan uji', 6, 72, true)
  RETURNING id INTO v_offering;
  INSERT INTO public.service_price_versions (offering_id, version, service_amount, currency, late_pickup_terms, status, proposed_by)
  VALUES (v_offering, 1, 150000, 'IDR', '{}', 'approved', current_setting('e2e.manager')::uuid)
  RETURNING id INTO v_price;
  UPDATE public.service_offerings SET published_price_id = v_price WHERE id = v_offering;

  PERFORM set_config('e2e.daycare', v_daycare::text, true);
  PERFORM set_config('e2e.offering', v_offering::text, true);
END
$setup$;

-- Helper: expect a specific RPC error code.
CREATE FUNCTION pg_temp.expect_error(p_sql text, p_code text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'E2E: expected % from: %', p_code, p_sql;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> p_code THEN RAISE; END IF;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_error(text, text) TO authenticated, anon, service_role;

-- -------------------------------------------- Parent 1: child + enrollment
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.parent'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_child uuid; v_enrollment uuid; v_list jsonb;
BEGIN
  v_child := public.app_create_parent_child('Anak Uji Satu', current_date - 400);
  PERFORM set_config('e2e.child', v_child::text, true);
  v_enrollment := public.app_create_enrollment(v_child, current_setting('e2e.offering')::uuid, current_date,
    'v1', '{"service_terms": true, "child_data_processing": true}', 'Saya menyetujui ketentuan pengasuhan Ayomi.', 'e2e-enroll-1');
  PERFORM set_config('e2e.enrollment', v_enrollment::text, true);
  v_list := public.app_list_enrollments();
  ASSERT jsonb_array_length(v_list) = 1, 'parent sees one enrollment';
  ASSERT v_list -> 0 ->> 'status' = 'pending', 'new enrollment is pending';
  ASSERT v_list -> 0 -> 'child' ->> 'full_name' = 'Anak Uji Satu', 'parent sees own child';
  PERFORM pg_temp.expect_error(format('SELECT public.app_create_enrollment(%L, %L, current_date, ''v1'', ''{"service_terms": true, "child_data_processing": true}'', ''Saya menyetujui ketentuan.'', ''x'')',
    v_child, current_setting('e2e.offering')), 'duplicate_active_enrollment');
  PERFORM pg_temp.expect_error(format('SELECT public.app_create_enrollment(%L, %L, current_date + 2, ''v1'', ''{"service_terms": true}'', ''Saya menyetujui ketentuan.'', ''x'')',
    v_child, current_setting('e2e.offering')), 'invalid_consent');
  -- Child CRUD rules
  PERFORM public.app_parent_update_child(v_child, 'Anak Uji Satu', current_date - 400, 'female', 'Alergi susu sapi');
  PERFORM pg_temp.expect_error(format('SELECT public.app_parent_update_child(%L, ''Anak Uji Satu'', current_date - 300, NULL, NULL)', v_child), 'child_has_enrollment_history');
  PERFORM pg_temp.expect_error(format('SELECT public.app_parent_archive_child(%L)', v_child), 'child_has_enrollment_history');
  v_child := public.app_create_parent_child('Anak Tanpa Riwayat', current_date - 500);
  PERFORM public.app_parent_archive_child(v_child);
  ASSERT NOT EXISTS (SELECT 1 FROM public.children WHERE child_id = v_child AND deleted_at IS NULL), 'archived child hidden';
END $$;
RESET ROLE;

-- ------------------------------- Parent 2: competing enrollments, isolation
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.parent2'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_child uuid;
BEGIN
  v_child := public.app_create_parent_child('Anak Uji Dua', current_date - 700);
  PERFORM set_config('e2e.enrollment2', public.app_create_enrollment(v_child, current_setting('e2e.offering')::uuid, current_date,
    'v1', '{"service_terms": true, "child_data_processing": true}', 'Saya menyetujui ketentuan pengasuhan Ayomi.', 'e2e-enroll-2')::text, true);
  PERFORM set_config('e2e.enrollment3', public.app_create_enrollment(v_child, current_setting('e2e.offering')::uuid, current_date + 1,
    'v1', '{"service_terms": true, "child_data_processing": true}', 'Saya menyetujui ketentuan pengasuhan Ayomi.', 'e2e-enroll-3')::text, true);
  PERFORM pg_temp.expect_error(format('SELECT public.app_get_enrollment(%L)', current_setting('e2e.enrollment')), 'enrollment_not_found');
  PERFORM pg_temp.expect_error(format('SELECT public.app_list_daily_activities(%L)', current_setting('e2e.enrollment')), 'enrollment_not_found');
  PERFORM pg_temp.expect_error(format('SELECT public.app_parent_update_child(%L, ''X Y'', current_date - 400, NULL, NULL)', current_setting('e2e.child')), 'child_not_owned');
END $$;
RESET ROLE;

-- ------------------------------------------- Manager: queue and decisions
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.manager'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_list jsonb; v_item jsonb;
BEGIN
  ASSERT jsonb_array_length(public.app_list_my_daycares()) = 1, 'manager sees own daycare';
  v_list := public.app_list_enrollments(current_setting('e2e.daycare')::uuid);
  ASSERT jsonb_array_length(v_list) = 3, 'manager queue has three enrollments';
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_list) LOOP
    ASSERT v_item -> 'child' = 'null'::jsonb, 'child identity hidden before approval';
  END LOOP;
  ASSERT public.app_manager_decide_enrollment(current_setting('e2e.enrollment')::uuid, 'accepted', 'Slot tersedia', 'e2e-d1') = 'pending_payment', 'accept opens checkout';
  PERFORM pg_temp.expect_error(format('SELECT public.app_manager_decide_enrollment(%L, ''accepted'', ''Slot tersedia'', ''x'')', current_setting('e2e.enrollment2')), 'daycare_capacity_full');
  PERFORM pg_temp.expect_error(format('SELECT public.app_manager_decide_enrollment(%L, NULL, ''Tanpa keputusan'', ''x'')', current_setting('e2e.enrollment2')), 'invalid_enrollment_decision');
  ASSERT public.app_manager_decide_enrollment(current_setting('e2e.enrollment2')::uuid, 'rejected', 'Kuota hari ini penuh', 'e2e-d2') = 'rejected', 'reject works';
  ASSERT public.app_manager_decide_enrollment(current_setting('e2e.enrollment3')::uuid, 'accepted', 'Slot besok tersedia', 'e2e-d3') = 'pending_payment', 'accept tomorrow';
  PERFORM pg_temp.expect_error(format('SELECT public.app_list_enrollments(%L)', gen_random_uuid()), 'manager_scope_required');
END $$;
RESET ROLE;

-- --------------------------------------------- Parent 1: pay, cancel rules
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.parent'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_detail jsonb;
BEGIN
  v_detail := public.app_get_enrollment(current_setting('e2e.enrollment')::uuid);
  ASSERT v_detail ->> 'status' = 'pending_payment', 'parent sees pending payment';
  ASSERT (v_detail -> 'charge' ->> 'total_amount')::bigint = 150000, 'charge uses approved price';
  PERFORM set_config('e2e.transaction', public.app_create_payment_ledger_entry((v_detail -> 'charge' ->> 'id')::uuid,
    'qris', 'e2e-idempotency-0001', now() + interval '1 hour')::text, true);
  PERFORM pg_temp.expect_error(format('SELECT public.app_parent_cancel_enrollment(%L, ''Batal'', ''x'')', current_setting('e2e.enrollment')), 'enrollment_cannot_be_cancelled');
END $$;
RESET ROLE;

-- -------------------------------------------------------- Admin: payment
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.admin'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT public.app_admin_record_payment_result(current_setting('e2e.transaction')::uuid, 'succeeded', 'manual', 'E2E-TRX-1',
  '{}', 0, 'RCPT-E2E-1', 'Pembayaran diverifikasi manual', 'e2e-pay');
RESET ROLE;

-- --------------------------------------- Manager: assign caregiver, check in
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.manager'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_detail jsonb;
BEGIN
  v_detail := public.app_get_enrollment(current_setting('e2e.enrollment')::uuid);
  ASSERT v_detail ->> 'status' = 'approved', 'payment approves enrollment';
  ASSERT v_detail -> 'child' ->> 'full_name' = 'Anak Uji Satu', 'manager sees child after approval';
  PERFORM public.app_manager_assign_caregiver(current_setting('e2e.enrollment')::uuid, current_setting('e2e.caregiver')::uuid,
    now() - interval '1 minute', now() + interval '8 hours', 'e2e-assign');
  PERFORM public.app_manager_check_in_enrollment(current_setting('e2e.enrollment')::uuid, 'e2e-checkin');
END $$;
RESET ROLE;

-- ---------------------------------------- Caregiver: daily log + incident
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.caregiver'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_draft uuid; v_sent uuid;
BEGIN
  ASSERT public.app_get_enrollment(current_setting('e2e.enrollment')::uuid) ->> 'viewer_role' = 'caregiver', 'assigned caregiver can open enrollment';
  v_draft := public.app_save_daily_activity(NULL, current_setting('e2e.enrollment')::uuid, current_date, 'play',
    'Draf bermain', 'Draf catatan bermain balok bersama teman.', now() - interval '2 minutes', '{}', 'draft', false, NULL, NULL, 'e2e-a1');
  ASSERT jsonb_array_length(public.app_list_daily_activities(current_setting('e2e.enrollment')::uuid)) = 1, 'caregiver sees own draft';
  PERFORM public.app_delete_draft_activity(v_draft);
  v_sent := public.app_save_daily_activity(NULL, current_setting('e2e.enrollment')::uuid, current_date, 'meal',
    'Makan siang', 'Menghabiskan nasi, sayur bayam, dan buah pepaya.', now() - interval '1 minute', '{}', 'sent', false, NULL, NULL, 'e2e-a2');
  PERFORM set_config('e2e.activity', v_sent::text, true);
  PERFORM pg_temp.expect_error(format('SELECT public.app_delete_draft_activity(%L)', v_sent), 'sent_activity_is_immutable');
  PERFORM set_config('e2e.incident', public.app_create_incident(current_setting('e2e.enrollment')::uuid, now() - interval '5 minutes',
    'Anak terbentur meja kecil saat bermain di ruang dalam.', 'Dikompres dingin', 'medium', 'Benjolan kecil di dahi',
    'e2e-incident-0001', 'e2e-inc')::text, true);
  PERFORM pg_temp.expect_error('SELECT public.app_list_incidents()', 'role_not_allowed');
END $$;
RESET ROLE;

-- ---------------------------------- Parent 1: read log, incident, notices
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.parent'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_notices jsonb; v_unread integer;
BEGIN
  ASSERT jsonb_array_length(public.app_list_daily_activities(current_setting('e2e.enrollment')::uuid)) = 1, 'parent sees only the sent activity';
  PERFORM public.app_acknowledge_activity(current_setting('e2e.activity')::uuid, 'parent_read');
  ASSERT jsonb_array_length(public.app_list_incidents()) = 1, 'parent sees incident';
  PERFORM public.app_parent_acknowledge_incident(current_setting('e2e.incident')::uuid);
  v_notices := public.app_list_my_notifications(false, 50);
  v_unread := (v_notices ->> 'unread_count')::integer;
  ASSERT v_unread >= 4, format('parent has notifications (got %s)', v_unread);
  PERFORM public.app_mark_notification((v_notices -> 'items' -> 0 ->> 'id')::uuid, true);
  ASSERT (public.app_list_my_notifications(true, 50) ->> 'unread_count')::integer = v_unread - 1, 'mark read reduces unread';
END $$;

-- Logbook love + comment (042)
DO $$
DECLARE v_activity uuid := current_setting('e2e.activity')::uuid; v_love jsonb; v_comment jsonb;
BEGIN
  v_love := public.app_set_activity_reaction(v_activity, true);
  ASSERT (v_love ->> 'love_count')::integer = 1 AND (v_love ->> 'loved_by_me')::boolean, 'parent loves activity';
  ASSERT (public.app_set_activity_reaction(v_activity, true) ->> 'love_count')::integer = 1, 'love is idempotent';
  ASSERT (public.app_list_daily_activities(current_setting('e2e.enrollment')::uuid) -> 0 ->> 'loved_by_me')::boolean, 'list shows loved_by_me';
  v_comment := public.app_add_activity_comment(v_activity, 'Terima kasih, Bu. Anak saya memang suka bayam.', 'e2e-comment-0001');
  ASSERT v_comment ->> 'author_role' = 'parent' AND (v_comment ->> 'is_mine')::boolean, 'parent comment created';
  ASSERT public.app_add_activity_comment(v_activity, 'Terima kasih, Bu. Anak saya memang suka bayam.', 'e2e-comment-0001') ->> 'id' = v_comment ->> 'id', 'retried comment is idempotent';
  PERFORM pg_temp.expect_error(format('SELECT public.app_add_activity_comment(%L, %L, NULL)', v_activity, '   '), 'invalid_comment_body');
  PERFORM pg_temp.expect_error(format('SELECT public.app_set_activity_reaction(%L, NULL)', v_activity), 'invalid_reaction_state');
  PERFORM set_config('e2e.comment', v_comment ->> 'id', true);
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.caregiver'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_activity uuid := current_setting('e2e.activity')::uuid; v_notices jsonb;
BEGIN
  ASSERT jsonb_array_length(public.app_list_activity_comments(v_activity)) = 1, 'caregiver sees parent comment';
  ASSERT public.app_list_activity_comments(v_activity) -> 0 ->> 'is_mine' = 'false', 'not marked as caregiver''s own';
  ASSERT public.app_add_activity_comment(v_activity, 'Sama-sama, Bunda. Besok ada menu sup.', NULL) ->> 'author_role' = 'caregiver', 'caregiver replies';
  PERFORM pg_temp.expect_error(format('SELECT public.app_set_activity_reaction(%L, true)', v_activity), 'reaction_not_allowed');
  PERFORM pg_temp.expect_error(format('SELECT public.app_delete_activity_comment(%L)', current_setting('e2e.comment')), 'comment_delete_not_allowed');
  v_notices := public.app_list_my_notifications(false, 50) -> 'items';
  ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(v_notices) AS n WHERE n ->> 'event_type' = 'daily_activity_loved'), 'caregiver notified of love';
  ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(v_notices) AS n WHERE n ->> 'event_type' = 'daily_activity_comment'), 'caregiver notified of comment';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.parent2'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM pg_temp.expect_error(format('SELECT public.app_list_activity_comments(%L)', current_setting('e2e.activity')), 'activity_not_found');
  PERFORM pg_temp.expect_error(format('SELECT public.app_set_activity_reaction(%L, true)', current_setting('e2e.activity')), 'activity_not_found');
  PERFORM pg_temp.expect_error(format('SELECT public.app_add_activity_comment(%L, ''Halo'', NULL)', current_setting('e2e.activity')), 'activity_not_found');
  ASSERT (SELECT count(*) FROM public.activity_comments) = 0, 'RLS hides other families'' comments';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.parent'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_activity uuid := current_setting('e2e.activity')::uuid;
BEGIN
  ASSERT (SELECT count(*) FROM public.activity_comments WHERE activity_id = v_activity) = 2, 'RLS lets the parent read the thread';
  ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(public.app_list_my_notifications(false, 50) -> 'items') AS n
                 WHERE n ->> 'event_type' = 'daily_activity_comment'), 'parent notified of caregiver reply';
  PERFORM public.app_delete_activity_comment(current_setting('e2e.comment')::uuid);
  ASSERT jsonb_array_length(public.app_list_activity_comments(v_activity)) = 1, 'deleted comment hidden';
  ASSERT (public.app_set_activity_reaction(v_activity, false) ->> 'love_count')::integer = 0, 'love removed';
  ASSERT (public.app_list_daily_activities(current_setting('e2e.enrollment')::uuid) -> 0 ->> 'comment_count')::integer = 1, 'list shows comment_count';
END $$;
RESET ROLE;

-- ------------------------------------------ Manager: resolve and complete
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.manager'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.app_update_incident_status(current_setting('e2e.incident')::uuid, 'resolved', 'Sudah ditangani dan orang tua dihubungi', 'e2e-res');
  PERFORM public.app_manager_complete_enrollment(current_setting('e2e.enrollment')::uuid, 'Anak dijemput orang tua', 'e2e-done');
  ASSERT public.app_list_incidents() -> 0 ->> 'status' = 'resolved', 'manager sees resolved incident';
END $$;
RESET ROLE;

-- --------------------------------------------------- Parent 1: review
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.parent'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT set_config('e2e.review', public.app_submit_review(current_setting('e2e.enrollment')::uuid, 5,
  'Pengasuh sangat komunikatif dan laporan hariannya rinci.', 'e2e-review')::text, true);
RESET ROLE;

-- ------------------------------------- Admin: moderate review and reply
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.admin'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_queue jsonb;
BEGIN
  v_queue := public.app_admin_list_moderation_queue();
  ASSERT jsonb_array_length(v_queue -> 'reviews') >= 1, 'pending review in queue';
  PERFORM public.app_admin_moderate_review((SELECT (r ->> 'version_id')::uuid FROM jsonb_array_elements(v_queue -> 'reviews') AS r
    WHERE r ->> 'review_id' = current_setting('e2e.review')), 'approved', 'Sesuai pedoman', 'e2e-mod');
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.manager'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT set_config('e2e.reply_version', public.app_manager_submit_review_reply(current_setting('e2e.review')::uuid,
  'Terima kasih atas kepercayaan Bunda.', 'e2e-reply')::text, true);
RESET ROLE;

SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('e2e.admin'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT public.app_admin_moderate_review_reply(current_setting('e2e.reply_version')::uuid, 'approved', 'Sesuai pedoman', 'e2e-mod2');
RESET ROLE;

-- ------------------------------------------------ Visitor: public reads
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SET LOCAL ROLE anon;
DO $$
DECLARE v_reviews jsonb;
BEGIN
  v_reviews := public.app_list_public_reviews(current_setting('e2e.daycare')::uuid);
  ASSERT (v_reviews ->> 'count')::integer = 1, 'published review is public';
  ASSERT v_reviews -> 'items' -> 0 -> 'reply' ->> 'body' = 'Terima kasih atas kepercayaan Bunda.', 'published reply is public';
  ASSERT NOT (v_reviews::text LIKE '%' || current_setting('e2e.parent') || '%'), 'review author is not exposed';
  ASSERT jsonb_array_length(public.app_list_daycare_offerings(current_setting('e2e.daycare')::uuid)) = 1, 'offerings are public';
  PERFORM pg_temp.expect_error('SELECT public.app_list_enrollments()', 'permission denied for function app_list_enrollments');
  ASSERT (SELECT count(*) FROM public.daycare_listing_profiles) = (SELECT count(*) FROM public.daycare_listings), 'catalog profiles are public';
  PERFORM pg_temp.expect_error('SELECT count(*) FROM public.activity_comments', 'permission denied for table activity_comments');
  PERFORM pg_temp.expect_error(format('SELECT public.app_list_activity_comments(%L)', gen_random_uuid()), 'permission denied for function app_list_activity_comments');
END $$;
RESET ROLE;

-- ------------------------------------------------------ Server: expiry job
UPDATE public.enrollments SET payment_deadline = now() - interval '1 minute'
WHERE id = current_setting('e2e.enrollment3')::uuid;
SET LOCAL ROLE service_role;
DO $$
BEGIN
  ASSERT public.app_expire_overdue_enrollments(50) >= 1, 'overdue checkout expires';
END $$;
RESET ROLE;
DO $$
BEGIN
  ASSERT (SELECT status FROM public.enrollments WHERE id = current_setting('e2e.enrollment3')::uuid) = 'expired', 'status is expired';
  ASSERT (SELECT status FROM public.charges WHERE enrollment_id = current_setting('e2e.enrollment3')::uuid) = 'expired', 'charge is expired';
END $$;

SELECT 'E2E OK' AS hasil;

ROLLBACK;
