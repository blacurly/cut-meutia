// Membuat ERD dari skema database Supabase production:
//   1. supabase/schema/live_schema_snapshot.sql: snapshot yang diambil langsung dari
//      database Supabase lewat pg_catalog (65 tabel, PK, FK);
//   2. supabase/migrations/*.sql (urut nama berkas): perubahan setelah snapshot.
//
//   node scripts/generate-erd.mjs
//
// Hasil di docs/03-erd/:
//   schema.dbml            buka di https://dbdiagram.io (Import > DBML) untuk diagram interaktif
//   erd-per-domain.md      satu diagram Mermaid per domain, lengkap dengan semua kolom
// Opsi --json <berkas>: simpan diagram Mermaid mentah untuk skrip render gambar.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "docs", "03-erd");
mkdirSync(out, { recursive: true });

const files = [path.join(root, "supabase", "schema", "live_schema_snapshot.sql"),
  ...readdirSync(path.join(root, "supabase", "migrations")).filter(f => f.endsWith(".sql")).sort()
    .map(f => path.join(root, "supabase", "migrations", f))];

const tables = new Map(); // nama -> { columns: Map(nama -> {type, pk, notNull, unique}), source }
const fks = [];           // { from, column, to, toColumn }
const name = s => s.replace(/"/g, "").replace(/^public\./i, "").toLowerCase();

function splitTopLevel(body) {
  const parts = []; let depth = 0, cur = "", quote = false;
  for (const ch of body) {
    if (ch === "'") quote = !quote;
    if (!quote && ch === "(") depth++;
    if (!quote && ch === ")") depth--;
    if (!quote && ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function addFk(from, column, to, toColumn = "id") {
  to = name(to);
  if (to.startsWith("auth.") || to.startsWith("storage.")) return;
  if (!fks.some(f => f.from === from && f.column === column && f.to === to)) fks.push({ from, column, to, toColumn });
}

function parseCreate(table, body, source) {
  const t = tables.get(table) ?? { columns: new Map(), source };
  tables.set(table, t);
  for (const part of splitTopLevel(body)) {
    const head = part.split(/\s+/)[0].toUpperCase();
    if (["CONSTRAINT", "PRIMARY", "UNIQUE", "CHECK", "FOREIGN", "EXCLUDE"].includes(head)) {
      const pk = part.match(/PRIMARY KEY\s*\(([^)]+)\)/i);
      if (pk) pk[1].split(",").map(c => name(c.trim())).forEach(c => t.columns.get(c) && (t.columns.get(c).pk = true));
      const uq = part.match(/UNIQUE\s*\(([^),]+)\)/i);
      if (uq && t.columns.get(name(uq[1].trim()))) t.columns.get(name(uq[1].trim())).unique = true;
      const fk = part.match(/FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s+([\w."]+)\s*\(([^)]+)\)/i);
      if (fk) addFk(table, name(fk[1].split(",")[0].trim()), fk[2], name(fk[3].split(",")[0].trim()));
      continue;
    }
    const m = part.match(/^("?[\w]+"?)\s+([\w]+(?:\s*\([^)]*\))?(?:\[\])?(?:\s+with time zone)?)/i);
    if (!m) continue;
    const col = name(m[1]);
    t.columns.set(col, {
      type: m[2].replace(/\s+/g, " ").toLowerCase(),
      pk: /PRIMARY KEY/i.test(part),
      notNull: /NOT NULL|PRIMARY KEY/i.test(part),
      unique: /\bUNIQUE\b/i.test(part),
    });
    const ref = part.match(/REFERENCES\s+([\w."]+)\s*(?:\(([^)]+)\))?/i);
    if (ref) addFk(table, col, ref[1], ref[2] ? name(ref[2]) : "id");
  }
}

for (const file of files) {
  const sql = readFileSync(file, "utf8").replace(/--[^\n]*/g, "");
  const source = path.relative(root, file).replace(/\\/g, "/");
  const createRe = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([\w."]+)\s*\(/gi;
  let m;
  while ((m = createRe.exec(sql))) {
    let depth = 1, i = createRe.lastIndex;
    for (; i < sql.length && depth; i++) { if (sql[i] === "(") depth++; else if (sql[i] === ")") depth--; }
    const table = name(m[1]);
    if (m[1].includes(".") && !/^"?public"?\./i.test(m[1])) continue;
    parseCreate(table, sql.slice(createRe.lastIndex, i - 1), source);
  }
  for (const stmt of sql.split(";")) {
    const alter = stmt.match(/ALTER TABLE\s+(?:ONLY\s+)?(?:IF EXISTS\s+)?([\w."]+)([\s\S]*)/i);
    if (!alter || !tables.has(name(alter[1]))) continue;
    const table = name(alter[1]);
    for (const fk of alter[2].matchAll(/FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s+([\w."]+)\s*\(([^)]+)\)/gi)) {
      addFk(table, name(fk[1].split(",")[0].trim()), fk[2], name(fk[3].split(",")[0].trim()));
    }
    for (const add of alter[2].matchAll(/ADD COLUMN\s+(?:IF NOT EXISTS\s+)?("?\w+"?)\s+([\w]+(?:\s*\([^)]*\))?)([^,]*)/gi)) {
      tables.get(table).columns.set(name(add[1]), { type: add[2].toLowerCase(), pk: false, notNull: /NOT NULL/i.test(add[3]), unique: false });
      const ref = add[3].match(/REFERENCES\s+([\w."]+)\s*(?:\(([^)]+)\))?/i);
      if (ref) addFk(table, name(add[1]), ref[1], ref[2] ? name(ref[2]) : "id");
    }
    for (const drop of alter[2].matchAll(/DROP COLUMN\s+(?:IF EXISTS\s+)?("?\w+"?)/gi)) tables.get(table).columns.delete(name(drop[1]));
  }
}
for (const t of tables.values()) for (const [, c] of t.columns) if (c.pk) c.notNull = true;
const validFks = fks.filter(f => tables.has(f.from) && tables.has(f.to));
const fkCols = new Set(validFks.map(f => `${f.from}.${f.column}`));

const DOMAINS = [
  ["Akun & peran", ["users", "daycare_members", "staff_invitations", "daycare_delegations", "delegation_permissions", "account_sanctions"]],
  ["Daycare & katalog", ["daycares", "daycare_listings", "daycare_listing_profiles", "daycare_photos", "service_offerings", "service_price_versions", "commission_rules"]],
  ["Anak", ["children", "child_health_profiles", "child_health_change_logs", "child_health_correction_requests"]],
  ["Pendaftaran", ["enrollments", "enrollment_service_dates", "enrollment_consents", "enrollment_status_logs", "caregiver_assignments"]],
  ["Pembayaran", ["charges", "transactions", "payment_details", "payment_webhook_events", "refunds", "financial_holds", "payouts", "payout_items", "daycare_payout_accounts", "payout_account_change_requests"]],
  ["Catatan harian & media", ["daily_reports", "daily_report_activities", "activity_comments", "activity_reactions", "activity_acknowledgements", "report_change_logs", "attachments", "attachment_variants"]],
  ["Penjemputan", ["authorized_pickups", "pickup_records"]],
  ["Insiden", ["incident_reports", "incident_ai_analyses", "incident_urgency_change_logs", "incident_status_logs", "incident_parent_acknowledgements"]],
  ["Legalitas & Safety Score", ["daycare_documents", "daycare_verifications", "daycare_safety_scores"]],
  ["Ulasan", ["reviews", "review_versions", "review_replies", "review_reply_versions"]],
  ["Komplain & investigasi", ["complaints", "complaint_status_logs", "complaint_assignments", "investigations", "admin_actions"]],
  ["Notifikasi", ["notifications", "notification_receipts", "notification_reminders", "notification_delivery_logs"]],
  ["AI, sistem & audit", ["ai_jobs", "system_settings", "audit_logs"]],
];
const placed = new Set(DOMAINS.flatMap(([, t]) => t));
const unplaced = [...tables.keys()].filter(t => !placed.has(t));
if (unplaced.length) DOMAINS.push(["Lainnya", unplaced]);

const mType = type => type.replace(/\(.*\)/, "").replace(/\[\]$/, "_array").replace(/\s+/g, "_");
const mCol = (table, col, c) => {
  const keys = [c.pk && "PK", fkCols.has(`${table}.${col}`) && "FK", !c.pk && c.unique && "UK"].filter(Boolean).join(", ");
  return `    ${mType(c.type)} ${col}${keys ? ` ${keys}` : ""}`;
};
const mEdge = f => `  ${f.to} ||--o{ ${f.from} : "${f.column}"`;

// 1. Per domain, semua kolom; tabel domain lain yang dirujuk ditampilkan tanpa kolom
const sections = [];
const domainJson = [];
DOMAINS.forEach(([domain, list], i) => {
  const set = new Set(list.filter(t => tables.has(t)));
  const edges = validFks.filter(f => set.has(f.from) || (set.has(f.to) && set.has(f.from)));
  const lines = ["erDiagram", ...edges.map(mEdge)];
  for (const t of set) {
    lines.push(`  ${t} {`);
    for (const [col, c] of tables.get(t).columns) lines.push(mCol(t, col, c));
    lines.push("  }");
  }
  const slug = `${String(i + 1).padStart(2, "0")}-${domain.toLowerCase().replace(/&/g, "dan").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
  domainJson.push({ slug, domain, mermaid: lines.join("\n") });
  sections.push(`## ${i + 1}. ${domain}\n\nTabel: ${[...set].map(t => `\`${t}\``).join(", ")}. Tabel dari domain lain yang dirujuk ditampilkan tanpa kolom.\n\n![${domain}](gambar/${slug}.png)\n\n\`\`\`mermaid\n${lines.join("\n")}\n\`\`\`\n`);
});
writeFileSync(path.join(out, "erd-per-domain.md"), `# ERD per domain (lengkap dengan kolom)

Dibuat otomatis oleh \`scripts/generate-erd.mjs\` dari \`database/001_create_tables.sql\` dan \`supabase/migrations/\`. Jangan diedit manual; jalankan ulang skripnya.

**${tables.size} tabel, ${validFks.length} relasi foreign key.** Notasi: \`PK\` primary key, \`FK\` foreign key, \`UK\` unique; \`A ||--o{ B\` artinya satu baris A dirujuk banyak baris B (label = kolom FK di B).

${sections.join("\n")}`);

// 2. DBML untuk dbdiagram.io
const dbml = [];
for (const [domain, list] of DOMAINS) {
  dbml.push(`TableGroup "${domain}" {\n${list.filter(t => tables.has(t)).map(t => `  ${t}`).join("\n")}\n}\n`);
}
for (const [t, info] of tables) {
  dbml.push(`Table ${t} {`);
  for (const [col, c] of info.columns) {
    const settings = [c.pk && "pk", !c.pk && c.notNull && "not null", !c.pk && c.unique && "unique"].filter(Boolean);
    dbml.push(`  ${col} ${c.type.replace(/\s+/g, "_").replace(/\(.*\)/, "")}${settings.length ? ` [${settings.join(", ")}]` : ""}`);
  }
  dbml.push("}\n");
}
for (const f of validFks) dbml.push(`Ref: ${f.from}.${f.column} > ${f.to}.${f.toColumn}`);
writeFileSync(path.join(out, "schema.dbml"), `// Skema database Ayomi, dibuat otomatis oleh scripts/generate-erd.mjs.\n// Buka di https://dbdiagram.io > Import > DBML.\n\n${dbml.join("\n")}\n`);

const jsonAt = process.argv.indexOf("--json");
if (jsonAt > 0) writeFileSync(process.argv[jsonAt + 1], JSON.stringify({ domains: domainJson }, null, 1));
console.log(`${tables.size} tabel, ${validFks.length} relasi, ${DOMAINS.length} domain${unplaced.length ? ` (tanpa domain: ${unplaced.join(", ")})` : ""}`);
