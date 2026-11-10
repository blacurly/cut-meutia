import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, "supabase", "migrations", "035_enrollment_backend.sql");
const preflightPath = path.join(root, "supabase", "audits", "preflight_enrollment_backend.sql");
const logbookMigrationPath = path.join(root, "supabase", "migrations", "036_logbook_notification_backend.sql");
const incidentMigrationPath = path.join(root, "supabase", "migrations", "037_incident_backend.sql");
const reviewMigrationPath = path.join(root, "supabase", "migrations", "038_review_backend.sql");

test("enrollment backend is an upgrade-only transactional migration", async () => {
  const source = await readFile(migrationPath, "utf8");
  assert.match(source, /^BEGIN;/);
  assert.match(source, /COMMIT;\s*$/);
  assert.doesNotMatch(source, /\bCREATE\s+TABLE\b/i);
  assert.doesNotMatch(source, /\bDROP\s+TABLE\b/i);
  assert.equal((source.match(/\$function\$/g) || []).length % 2, 0);
});

test("all enrollment mutations use authenticated RPCs with revoked public access", async () => {
  const source = await readFile(migrationPath, "utf8");
  const rpcs = [
    "app_create_enrollment",
    "app_manager_decide_enrollment",
    "app_parent_cancel_enrollment",
    "app_create_payment_ledger_entry",
    "app_admin_record_payment_result",
    "app_manager_assign_caregiver",
  ];

  for (const rpc of rpcs) {
    assert.match(source, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`));
    assert.match(source, new RegExp(`REVOKE ALL ON FUNCTION public\\.${rpc}\\(`));
    assert.match(source, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\(`));
  }
  assert.match(source, /FROM PUBLIC, anon;/);
  assert.match(source, /TO authenticated;/);
});

test("preflight verifies existing schema instead of recreating it", async () => {
  const source = await readFile(preflightPath, "utf8");
  assert.doesNotMatch(source, /\bCREATE\s+TABLE\b/i);
  for (const table of [
    "public.enrollments",
    "public.enrollment_consents",
    "public.enrollment_status_logs",
    "public.charges",
    "public.transactions",
    "public.notifications",
    "public.audit_logs",
  ]) {
    assert.ok(source.includes(`('${table}')`), `preflight must verify ${table}`);
  }
});

test("logbook and notification writes are authenticated upgrade-only RPCs", async () => {
  const source = await readFile(logbookMigrationPath, "utf8");
  assert.doesNotMatch(source, /\b(?:CREATE|DROP)\s+TABLE\b/i);
  assert.match(source, /^BEGIN;/);
  assert.match(source, /COMMIT;\s*$/);
  for (const rpc of [
    "app_save_daily_activity",
    "app_acknowledge_activity",
    "app_mark_notification",
  ]) {
    assert.match(source, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`));
    assert.match(source, new RegExp(`REVOKE ALL ON FUNCTION public\\.${rpc}\\(`));
    assert.match(source, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\(`));
  }
});

test("incident lifecycle remains manual, authenticated, and AI-free", async () => {
  const source = await readFile(incidentMigrationPath, "utf8");
  assert.doesNotMatch(source, /\b(?:CREATE|DROP)\s+TABLE\b/i);
  assert.doesNotMatch(source, /incident_ai_analyses|ai_jobs|ai_job_id/i);
  for (const rpc of [
    "app_manager_check_in_enrollment",
    "app_manager_complete_enrollment",
    "app_create_incident",
    "app_update_incident_status",
    "app_parent_acknowledge_incident",
  ]) {
    assert.match(source, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`));
    assert.match(source, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\(`));
  }
});

test("review and reply moderation is manual and authenticated", async () => {
  const source = await readFile(reviewMigrationPath, "utf8");
  assert.doesNotMatch(source, /\b(?:CREATE|DROP)\s+TABLE\b/i);
  for (const rpc of [
    "app_submit_review", "app_admin_moderate_review",
    "app_manager_submit_review_reply", "app_admin_moderate_review_reply",
    "app_parent_withdraw_review",
  ]) {
    assert.match(source, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`));
    assert.match(source, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\(`));
  }
  assert.match(source, /manual moderation/i);
});

const allMigrationPaths = [migrationPath, logbookMigrationPath, incidentMigrationPath, reviewMigrationPath];
const functionBody = (source, name) => {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  return source.slice(start, source.indexOf("$function$;", start));
};

test("guards stay closed when a role or enum parameter is NULL", async () => {
  for (const file of allMigrationPaths) {
    const source = await readFile(file, "utf8");
    // `NULL <> 'admin'` is NULL, which an IF treats as "not raised".
    assert.doesNotMatch(source, /app_current_role\(\)\s*<>/, `${path.basename(file)} must use IS DISTINCT FROM`);
    // Every enum-like parameter check must handle NULL (COALESCE or IS NULL).
    for (const [, param] of source.matchAll(/(?<!COALESCE\()\b(p_[a-z_]+)\s+NOT\s+(?:IN|BETWEEN)\b/g)) {
      assert.match(source, new RegExp(`${param} IS NULL OR ${param} NOT`), `${path.basename(file)}: ${param} needs a NULL guard`);
    }
  }
});

test("manager approval blocks a second active enrollment and respects capacity under concurrency", async () => {
  const body = functionBody(await readFile(migrationPath, "utf8"), "app_manager_decide_enrollment");
  assert.match(body, /p_decision IS NULL OR p_decision NOT IN/);
  assert.match(body, /FROM public\.children WHERE id = v_enrollment\.child_id FOR UPDATE/);
  assert.match(body, /child_has_active_enrollment/);
  assert.match(body, /FROM public\.daycares\s+WHERE id = v_enrollment\.daycare_id\s+FOR UPDATE/);
  // Expired checkouts must not keep holding a capacity slot.
  assert.match(body, /status = 'pending_payment' AND payment_deadline > now\(\)/);
});

test("payment success refuses to activate a second enrollment for the same child", async () => {
  const body = functionBody(await readFile(migrationPath, "utf8"), "app_admin_record_payment_result");
  assert.match(body, /child_has_active_enrollment/);
});

test("parents can self-cancel only pending enrollments", async () => {
  const body = functionBody(await readFile(migrationPath, "utf8"), "app_parent_cancel_enrollment");
  assert.match(body, /IF v_enrollment\.status <> 'pending' THEN/);
  assert.doesNotMatch(body, /'pending_payment', 'approved'/);
});

test("overdue checkouts expire through a service_role-only job", async () => {
  const source = await readFile(migrationPath, "utf8");
  const body = functionBody(source, "app_expire_overdue_enrollments");
  assert.match(body, /FOR UPDATE SKIP LOCKED/);
  assert.match(body, /SET status = 'expired'/);
  assert.match(source, /REVOKE ALL ON FUNCTION public\.app_expire_overdue_enrollments\(integer\)\s+FROM PUBLIC, anon, authenticated;/);
  assert.match(source, /GRANT EXECUTE ON FUNCTION public\.app_expire_overdue_enrollments\(integer\)\s+TO service_role;/);
});
