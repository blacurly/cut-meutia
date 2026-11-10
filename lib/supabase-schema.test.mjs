// Checks the RPC migrations against the live schema snapshot
// (supabase/schema/live_schema_snapshot.sql). PL/pgSQL does not validate
// column names or NOT NULL columns when a function is created, so these
// mistakes otherwise only surface when the RPC is called in production.
import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");
// Migrations written against the live schema (030-034 predate the snapshot
// and are themselves copies of live definitions).
const CHECKED = /^(03[5-9]|04\d)_/;

async function liveTables() {
  const snapshot = await readFile(path.join(root, "supabase", "schema", "live_schema_snapshot.sql"), "utf8");
  const tables = {};
  for (const [, name, body] of snapshot.matchAll(/CREATE TABLE public\.(\w+) \(\r?\n([\s\S]*?)\r?\n\);/g)) {
    const lines = body.split(/\r?\n/).map(line => line.trim()).filter(line => !line.startsWith("CONSTRAINT"));
    tables[name] = {
      columns: new Set(lines.map(line => line.split(" ")[0])),
      required: lines.filter(line => / NOT NULL,?$/.test(line) && !/ DEFAULT /.test(line)).map(line => line.split(" ")[0]),
    };
  }
  return tables;
}

async function checkedMigrations() {
  const files = (await readdir(migrationsDir)).filter(file => CHECKED.test(file)).sort();
  return Promise.all(files.map(async file => [file, await readFile(path.join(migrationsDir, file), "utf8")]));
}

test("snapshot contains the core tables", async () => {
  const tables = await liveTables();
  for (const name of ["children", "enrollments", "charges", "transactions", "daily_report_activities", "incident_reports", "reviews", "daycare_listings"]) {
    assert.ok(tables[name], `snapshot is missing public.${name}`);
  }
  assert.ok(tables.children.columns.has("child_id") && !tables.children.columns.has("id"), "children key is child_id");
});

test("every INSERT fills all NOT NULL columns that have no default", async () => {
  const tables = await liveTables();
  const problems = [];
  for (const [file, sql] of await checkedMigrations()) {
    for (const [, table, list] of sql.matchAll(/INSERT INTO public\.(\w+) \(([^)]*)\)/g)) {
      if (!tables[table]) continue; // created by the same migration
      const given = list.split(",").map(column => column.trim());
      const missing = tables[table].required.filter(column => !given.includes(column));
      if (missing.length) problems.push(`${file}: INSERT ${table} tanpa ${missing.join(", ")}`);
      const unknown = given.filter(column => !tables[table].columns.has(column));
      if (unknown.length) problems.push(`${file}: INSERT ${table} memakai kolom yang tidak ada: ${unknown.join(", ")}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("every UPDATE sets columns that exist", async () => {
  const tables = await liveTables();
  const problems = [];
  for (const [file, sql] of await checkedMigrations()) {
    for (const [, table, assignments] of sql.matchAll(/UPDATE public\.(\w+)\s+SET ([\s\S]*?)\bWHERE\b/g)) {
      if (!tables[table]) continue;
      for (const [, column] of assignments.matchAll(/(?:^|,)\s*(\w+)\s*=/g)) {
        if (!tables[table].columns.has(column)) problems.push(`${file}: UPDATE ${table} memakai kolom yang tidak ada: ${column}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});
