// Prepares the team and daycare photos for the website.
//
//   npm run foto
//
// Input (raw photos, NOT committed; folder is git-ignored):
//   foto-mentah/tim/1.jpg ... 4.jpg            one photo per team member,
//                                              number = id in lib/team.js
//   foto-mentah/daycare/<slug>/*.jpg           up to 6 photos per daycare;
//                                              file name order = display order,
//                                              the first one is the cover
//   foto-mentah/daycare/*.jpg                  shared example pictures (not
//                                              of a specific daycare), shown,
//                                              labelled "Ilustrasi", for every
//                                              daycare without its own photos
// <slug> is the last part of the daycare's detail URL, e.g.
// /detail/aamillah-daycare-bekasi -> foto-mentah/daycare/aamillah-daycare-bekasi/
//
// Output (committed):
//   public/images/tim/anggota-<n>.webp         800x800, cropped to the face area
//   public/images/daycares/<slug>/<n>.webp     max 1600x1000
//   public/images/daycares/ilustrasi/<n>.webp  shared example pictures
//   lib/site-photos.json                       list the website reads
// Metadata (EXIF, including GPS location) is removed from every output.
// A daycare folder in public/images/daycares can be deleted to remove its
// photos; run the command again afterwards to update the list.
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { TEAM } from "../lib/team.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "foto-mentah");
const PUBLIC = path.join(ROOT, "public", "images");
const MANIFEST = path.join(ROOT, "lib", "site-photos.json");
const INPUT = /\.(jpe?g|png|webp)$/i;
const MAX_DAYCARE_PHOTOS = 6;
const TEAM_SIZE = 4;
const MAX_SHARED = 12;
const SHARED = "ilustrasi";

const exists = async target => stat(target).then(() => true, () => false);
const listFiles = async dir => ((await exists(dir)) ? (await readdir(dir)).sort((a, b) => a.localeCompare(b, "id", { numeric: true })) : []);

// Catalog slugs and names from the seed (supabase/seed/daycare_listings_seed.sql).
async function catalogSlugs() {
  const sql = await readFile(path.join(ROOT, "supabase", "seed", "daycare_listings_seed.sql"), "utf8");
  const slugs = new Map();
  for (const match of sql.matchAll(/\('(?:dki|jabar|jatim)', \d+, '([a-z0-9-]+)', '((?:[^']|'')*)'/g)) slugs.set(match[1], match[2].replace(/''/g, "'"));
  return slugs;
}

function suggest(slug, slugs) {
  const words = slug.split("-").filter(word => word.length > 2);
  return [...slugs.keys()].filter(known => words.some(word => known.includes(word))).slice(0, 5);
}

// photoCrop in lib/team.js: { x, y, size }. x/y = centre of the square as a
// fraction of the photo width/height (0–1); size = side of the square as a
// fraction of the photo's shorter side. Used when the automatic crop misses
// the face, e.g. for full-body photos.
function cropBox(meta, { x = 0.5, y = 0.5, size = 1 }) {
  const turned = (meta.orientation ?? 1) >= 5;
  const width = turned ? meta.height : meta.width;
  const height = turned ? meta.width : meta.height;
  const side = Math.round(Math.min(width, height) * Math.min(Math.max(size, 0.1), 1));
  const clamp = (value, max) => Math.min(Math.max(Math.round(value), 0), max);
  return { left: clamp(x * width - side / 2, width - side), top: clamp(y * height - side / 2, height - side), width: side, height: side };
}

async function processTeam(report) {
  const dir = path.join(RAW, "tim");
  await mkdir(path.join(PUBLIC, "tim"), { recursive: true });
  for (const file of await listFiles(dir)) {
    const id = Number.parseInt(file, 10);
    if (!INPUT.test(file) || !(id >= 1 && id <= TEAM_SIZE)) {
      report.warnings.push(`tim/${file}: nama file harus 1–${TEAM_SIZE} (mis. 1.jpg), dilewati.`);
      continue;
    }
    const source = path.join(dir, file);
    const crop = TEAM.find(member => member.id === id)?.photoCrop;
    const image = sharp(source).rotate();
    if (crop) image.extract(cropBox(await sharp(source).metadata(), crop));
    await image
      .resize(800, 800, { fit: "cover", position: sharp.strategy.attention })
      .webp({ quality: 82 }).toFile(path.join(PUBLIC, "tim", `anggota-${id}.webp`));
    report.done.push(`tim/${file} -> /images/tim/anggota-${id}.webp`);
  }
}

const toDaycareWebp = (source, target) => sharp(source).rotate()
  .resize(1600, 1000, { fit: "inside", withoutEnlargement: true })
  .webp({ quality: 80 }).toFile(target);

async function processShared(report) {
  const dir = path.join(RAW, "daycare");
  const files = [];
  for (const file of await listFiles(dir)) if (INPUT.test(file) && (await stat(path.join(dir, file))).isFile()) files.push(file);
  if (!files.length) return;
  if (files.length > MAX_SHARED) report.warnings.push(`daycare/: ${files.length} gambar contoh, hanya ${MAX_SHARED} pertama yang dipakai.`);
  const out = path.join(PUBLIC, "daycares", SHARED);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const [index, file] of files.slice(0, MAX_SHARED).entries()) {
    await toDaycareWebp(path.join(dir, file), path.join(out, `${index + 1}.webp`));
  }
  report.done.push(`daycare/ (gambar contoh untuk semua daycare): ${Math.min(files.length, MAX_SHARED)} gambar`);
}

async function processDaycares(report, slugs) {
  const dir = path.join(RAW, "daycare");
  for (const slug of await listFiles(dir)) {
    if (!(await stat(path.join(dir, slug))).isDirectory()) continue;
    if (!slugs.has(slug)) {
      const hints = suggest(slug, slugs);
      report.warnings.push(`daycare/${slug}: slug tidak ada di katalog, dilewati.${hints.length ? ` Mungkin: ${hints.join(", ")}` : ""}`);
      continue;
    }
    const files = (await listFiles(path.join(dir, slug))).filter(file => INPUT.test(file));
    if (!files.length) continue;
    if (files.length > MAX_DAYCARE_PHOTOS) report.warnings.push(`daycare/${slug}: ${files.length} foto, hanya ${MAX_DAYCARE_PHOTOS} pertama yang dipakai.`);
    const out = path.join(PUBLIC, "daycares", slug);
    await rm(out, { recursive: true, force: true });
    await mkdir(out, { recursive: true });
    for (const [index, file] of files.slice(0, MAX_DAYCARE_PHOTOS).entries()) {
      await toDaycareWebp(path.join(dir, slug, file), path.join(out, `${index + 1}.webp`));
    }
    report.done.push(`daycare/${slug} (${slugs.get(slug)}): ${Math.min(files.length, MAX_DAYCARE_PHOTOS)} foto`);
  }
}

// The list is built from what is in public/images, so deleting a folder
// there removes the photos from the website.
async function buildManifest(slugs) {
  const team = {};
  for (let id = 1; id <= TEAM_SIZE; id += 1) {
    if (await exists(path.join(PUBLIC, "tim", `anggota-${id}.webp`))) team[id] = `/images/tim/anggota-${id}.webp`;
  }
  const daycares = {};
  for (const slug of await listFiles(path.join(PUBLIC, "daycares"))) {
    if (!slugs.has(slug)) continue;
    const files = (await listFiles(path.join(PUBLIC, "daycares", slug))).filter(file => /^\d+\.webp$/.test(file));
    if (files.length) daycares[slug] = files.map(file => `/images/daycares/${slug}/${file}`);
  }
  const illustrations = (await listFiles(path.join(PUBLIC, "daycares", SHARED)))
    .filter(file => /^\d+\.webp$/.test(file)).map(file => `/images/daycares/${SHARED}/${file}`);
  await writeFile(MANIFEST, `${JSON.stringify({ team, daycares, illustrations }, null, 2)}\n`);
  return { team: Object.keys(team).length, daycares: Object.keys(daycares).length, illustrations: illustrations.length };
}

const report = { done: [], warnings: [] };
const slugs = await catalogSlugs();
if (!(await exists(RAW))) {
  await mkdir(path.join(RAW, "tim"), { recursive: true });
  await mkdir(path.join(RAW, "daycare"), { recursive: true });
  console.log("Folder foto-mentah/tim dan foto-mentah/daycare dibuat. Masukkan foto, lalu jalankan lagi: npm run foto");
}
await processTeam(report);
await processShared(report);
await processDaycares(report, slugs);
const total = await buildManifest(slugs);
for (const line of report.done) console.log(`✓ ${line}`);
for (const line of report.warnings) console.warn(`! ${line}`);
console.log(`\nSelesai: ${total.team} foto tim, ${total.daycares} daycare berfoto, dan ${total.illustrations} gambar contoh tercatat di lib/site-photos.json.`);
console.log("Cek dengan npm run dev, lalu commit folder public/images/tim, public/images/daycares, dan lib/site-photos.json.");
