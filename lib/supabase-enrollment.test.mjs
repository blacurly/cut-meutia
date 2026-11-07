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
