// Builds supabase/seed/daycare_listings_seed.sql and the data-quality report
// from the team's daycare CSV files. The raw CSVs are not committed
// (Technical Requirement: datasets stay out of the repository).
//
// Usage:
//   node scripts/build-daycare-seed.mjs --dki <csv> --jabar <csv> --jatim <csv>
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROVINCES, buildListings, toSeedSql } from "../lib/daycare-dataset.js";
import { FACILITY_TAGS } from "../lib/daycare-facilities.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) =>
  arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs, []));

const missing = Object.keys(PROVINCES).filter(key => !args[key]);
if (missing.length) {
  console.error(`Lengkapi path CSV untuk: ${missing.map(key => `--${key}`).join(" ")}`);
  process.exit(1);
}

const datasets = {};
for (const key of Object.keys(PROVINCES)) datasets[key] = await readFile(args[key], "utf8");
const { listings, excluded } = buildListings(datasets);

const seedPath = path.join(root, "supabase", "seed", "daycare_listings_seed.sql");
await mkdir(path.dirname(seedPath), { recursive: true });
await writeFile(seedPath, toSeedSql(listings));

const legalLabels = {
  referenced: "Ada referensi izin publik (NPSN/SK)",
  claimed_without_reference: "Ditandai terverifikasi tanpa bukti spesifik",
  in_review: "Proses verifikasi",
  not_available: "Belum ada data legalitas",
};
const count = (items, fn) => items.filter(fn).length;
const lines = [
  "# Dataset daycare 3 provinsi",
  "",
  "Dihasilkan otomatis oleh `scripts/build-daycare-seed.mjs`. Jangan diedit manual.",
  "",
  "## Ringkasan",
  "",
  "| Provinsi | Daycare dimuat | Ada rating | Ada referensi izin publik |",
  "| --- | ---: | ---: | ---: |",
  ...Object.entries(PROVINCES).map(([key, province]) => {
    const rows = listings.filter(l => l.sourceDataset === key);
    return `| ${province.name} | ${rows.length} | ${count(rows, l => l.publicRating != null)} | ${count(rows, l => l.legalStatus === "referenced")} |`;
  }),
  `| **Total** | **${listings.length}** | **${count(listings, l => l.publicRating != null)}** | **${count(listings, l => l.legalStatus === "referenced")}** |`,
  "",
  "## Status legalitas",
  "",
  ...Object.entries(legalLabels).map(([key, label]) => `- ${label}: ${count(listings, l => l.legalStatus === key)}`),
  "",
  "Status ini menggambarkan bukti di dataset, bukan hasil verifikasi tim Ayomi.",
  "",
  "## Penanda fasilitas",
  "",
  ...Object.entries(FACILITY_TAGS).map(([key, label]) => `- ${label}: ${count(listings, l => l.facilityTags.includes(key))}`),
  "",
  "## Tidak dimuat",
  "",
  ...(excluded.length ? excluded.map(e => `- ${PROVINCES[e.dataset].name} No. ${e.sourceRow} — ${e.name}: ${e.reason}`) : ["- Tidak ada."]),
  "",
  "## Catatan kualitas data per baris",
  "",
  "| Provinsi | No. | Daycare | Catatan |",
  "| --- | ---: | --- | --- |",
  ...listings.filter(l => l.dataQualityNotes.length).map(l =>
    `| ${l.provinceName} | ${l.sourceRow} | ${l.name.replace(/\|/g, "/")} | ${l.dataQualityNotes.join(" ")} |`),
  "",
];
const reportPath = path.join(root, "docs", "dataset-daycare-3-provinsi.md");
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, lines.join("\n"));

console.log(`${listings.length} daycare dimuat, ${excluded.length} dikecualikan.`);
console.log(`Seed   : ${path.relative(root, seedPath)}`);
console.log(`Laporan: ${path.relative(root, reportPath)}`);
