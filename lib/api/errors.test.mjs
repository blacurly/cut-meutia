import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RPC_ERRORS, databaseData } from "./errors.js";

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "migrations");

test("every error code raised by a migration has an HTTP mapping", async () => {
  const codes = new Set();
  for (const file of await readdir(migrations)) {
    const sql = await readFile(path.join(migrations, file), "utf8");
    for (const [, code] of sql.matchAll(/MESSAGE\s*=\s*'([a-z_]+)'/g)) codes.add(code); // with or without spaces
  }
  const missing = [...codes].filter(code => !Object.hasOwn(RPC_ERRORS, code));
  assert.deepEqual(missing, [], `Tambahkan pemetaan di lib/api/errors.js untuk: ${missing.join(", ")}`);
});

test("ownership errors never reveal that a foreign record exists", () => {
  for (const [code, [status]] of Object.entries(RPC_ERRORS)) {
    if (code.endsWith("_not_owned")) assert.equal(status, 404, code);
  }
});

test("known codes keep their status; unknown errors become a generic 500", () => {
  assert.throws(() => databaseData({ error: { message: "daycare_capacity_full" } }), error => error.status === 409 && error.code === "daycare_capacity_full");
  assert.throws(() => databaseData({ error: { message: "duplicate key value violates unique constraint" } }), error => error.status === 500 && !error.message.includes("duplicate"));
  assert.deepEqual(databaseData({ data: [1], error: null }), [1]);
});
