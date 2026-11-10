// Builds supabase/seed/daycare_listing_profiles_seed.sql (synthetic fees,
// ratio, capacity, ages, hours and illustration gallery) for every published
// catalog entry. Listings are read through the public Data API with the
// publishable key, so no database password is needed.
//
// Usage: node scripts/build-synthetic-profiles.mjs [--env .env.local]
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toProfileSeedSql } from "../lib/daycare-synthetic.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envIndex = process.argv.indexOf("--env");
const envFile = envIndex > -1 ? process.argv[envIndex + 1] : path.join(root, ".env.local");

const env = { ...process.env };
try {
  for (const line of (await readFile(envFile, "utf8")).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match && !env[match[1]]) env[match[1]] = match[2];
  }
} catch {
  // Environment variables may already be set (CI).
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY terlebih dahulu.");
  process.exit(1);
}

const columns = "slug,name,province_code,province_name,city_name,district_name,facility_tags";
const response = await fetch(`${url}/rest/v1/daycare_listings?select=${columns}&order=slug`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (!response.ok) {
  console.error(`Gagal membaca katalog: HTTP ${response.status}`);
  process.exit(1);
}
const listings = await response.json();
const seedPath = path.join(root, "supabase", "seed", "daycare_listing_profiles_seed.sql");
await writeFile(seedPath, toProfileSeedSql(listings));
console.log(`${listings.length} profil sintetis ditulis ke ${path.relative(root, seedPath)}`);
