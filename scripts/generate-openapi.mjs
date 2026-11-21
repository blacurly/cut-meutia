// Membuat dokumentasi API OpenAPI 3.1 langsung dari kode:
//   - daftar endpoint dan metode dari app/api/**/route.js;
//   - field body yang diterima dari readObject(...)/readUpload(...) di lib/api, beserta
//     tipe dan aturannya dari validator (uuid, text, oneOf, integer, boolean, isoDate, timestamp);
//   - query parameter dari pemanggilan .get("...");
//   - kode error yang dilempar handler (reject(...), new ApiError(...)) beserta status HTTP-nya;
//   - ringkasan, hak akses, dan contoh dari scripts/openapi/*.json.
//
//   node scripts/generate-openapi.mjs
//
// Hasil: docs/05-api/openapi.json dan docs/05-api/swagger.html (Swagger UI, spesifikasi
// disematkan sehingga bisa dibuka langsung dari berkas).
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "docs", "05-api");
mkdirSync(outDir, { recursive: true });
const META = JSON.parse(readFileSync(path.join(root, "scripts/openapi/endpoints.json"), "utf8"));
const EXAMPLES = JSON.parse(readFileSync(path.join(root, "scripts/openapi/examples.json"), "utf8"));
const PRODUCTION = "https://project-ayomi-cut-meutia.vercel.app";

// ---------------------------------------------------------------- kode error -> status
const errorStatus = {};
const errorsSrc = readFileSync(path.join(root, "lib/api/errors.js"), "utf8");
for (const m of errorsSrc.matchAll(/^\s*(\w+):\s*\[(\d{3}),\s*"([^"]*)"/gm)) errorStatus[m[1]] = { status: Number(m[2]), message: m[3] };

// ---------------------------------------------------------------- sumber lib/api
const libCache = {};
const lib = mod => (libCache[mod] ??= readFileSync(path.join(root, `${mod}.js`), "utf8"));

function functionSource(src, name) {
  const re = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = re.exec(src);
  if (!m) {
    const arrow = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*(?:async\\s*)?\\(`).exec(src);
    if (!arrow) return "";
    return blockFrom(src, arrow.index);
  }
  return blockFrom(src, m.index);
}
function blockFrom(src, start) {
  const open = src.indexOf("{", src.indexOf(")", start));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}
function constArray(src, name) {
  const m = new RegExp(`const\\s+${name}\\s*=\\s*(\\[[^\\]]*\\])`).exec(src);
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : null;
}
function constObjectKeys(src, name) {
  const m = new RegExp(`const\\s+${name}\\s*=\\s*\\{`).exec(src);
  if (!m) return null;
  const body = blockFrom(src, m.index);
  return [...body.matchAll(/^\s*(\w+)\s*:/gm)].map(x => x[1]);
}
const listOrConst = (src, expr) => expr.trim().startsWith("[")
  ? [...expr.matchAll(/"([^"]+)"/g)].map(x => x[1])
  : constArray(src, expr.trim()) ?? (constObjectKeys(src, expr.trim().replace(/^Object\.keys\(|\)$/g, "")) ?? []);

// Kumpulkan sumber handler beserta helper lokal yang dipanggil dengan request/body.
function handlerSource(src, name, seen = new Set()) {
  if (seen.has(name)) return "";
  seen.add(name);
  const own = functionSource(src, name);
  let all = own;
  for (const m of own.matchAll(/\b(\w+)\((?:context,\s*)?(?:request|body|form|values)\b/g)) {
    if (["readObject", "readOptionalObject", "readUpload", "uuid", "text", "oneOf", "integer", "boolean", "isoDate", "timestamp"].includes(m[1])) continue;
    if (new RegExp(`function\\s+${m[1]}\\s*\\(`).test(src)) all += "\n" + handlerSource(src, m[1], seen);
  }
  return all;
}

function analyse(mod, fn) {
  const src = lib(mod);
  const code = handlerSource(src, fn);
  const info = { body: null, multipart: null, query: new Set(), errors: new Set() };
  const ro = /readOptionalObject|readObject\(request,\s*([^)]*?\]|\w+)\s*\)/.exec(code);
  const roAll = /(readOptionalObject|readObject)\(request,\s*(\[[^\]]*\]|\w+)/.exec(code);
  if (roAll) info.body = { optional: roAll[1] === "readOptionalObject", fields: listOrConst(src, roAll[2]) };
  void ro;
  const up = /readUpload\(request,\s*(\[[^\]]*\]|\w+)/.exec(code);
  if (up) info.multipart = { fields: listOrConst(src, up[1]), file: true };
  if (/request\.formData\(\)/.test(code)) {
    const fields = [...new Set([...code.matchAll(/form\.get\("(\w+)"\)/g)].map(x => x[1]))];
    info.multipart = { fields: fields.filter(f => f !== "file"), file: fields.includes("file") || /form\.getAll\("file"\)/.test(code) };
  }
  for (const m of code.matchAll(/\b(?:query|params|searchParams|search)\??\.get\("(\w+)"\)/g)) info.query.add(m[1]);
  for (const m of code.matchAll(/reject\("(\w+)"\)/g)) info.errors.add(m[1]);
  for (const m of code.matchAll(/new ApiError\((\d{3}),\s*"(\w+)",\s*"([^"]*)"/g)) {
    info.errors.add(m[2]);
    errorStatus[m[2]] ??= { status: Number(m[1]), message: m[3] };
  }
  for (const m of code.matchAll(/\binvalid\("(\w+)",\s*"([^"]*)"/g)) {
    info.errors.add(`invalid_${m[1]}`);
    errorStatus[`invalid_${m[1]}`] ??= { status: 400, message: m[2] };
  }
  info.props = {};
  const fieldList = [...(info.body?.fields ?? []), ...(info.multipart?.fields ?? [])];
  for (const f of fieldList) info.props[f] = describeField(code, src, f);
  return info;
}

function describeField(code, src, f) {
  const access = `(?:body|values|input)\\.${f}\\b|form\\.get\\("${f}"\\)`;
  const call = name => new RegExp(`\\b${name}\\(\\s*(?:${access})([^;]*)`).exec(code);
  let m;
  if ((m = call("uuid"))) return { type: "string", format: "uuid" };
  if ((m = call("isoDate"))) return { type: "string", format: "date" };
  if ((m = call("timestamp"))) return { type: "string", format: "date-time" };
  if ((m = call("boolean"))) return { type: "boolean" };
  if ((m = call("integer"))) {
    const s = { type: "integer" };
    const min = /min:\s*(-?\d+)/.exec(m[1]); const max = /max:\s*(-?\d+)/.exec(m[1]);
    if (min) s.minimum = Number(min[1]); if (max) s.maximum = Number(max[1]);
    return s;
  }
  if ((m = call("oneOf"))) {
    const arg = /^\s*,\s*"[^"]*",\s*(\[[^\]]*\]|[\w.]+)/.exec(m[1]);
    const values = arg ? listOrConst(src, arg[1]) : [];
    return values.length ? { type: "string", enum: values } : { type: "string" };
  }
  if ((m = call("text"))) {
    const s = { type: "string" };
    const min = /min:\s*(\d+)/.exec(m[1]); const max = /max:\s*([\d_]+)/.exec(m[1]);
    if (min && Number(min[1]) > 0) s.minLength = Number(min[1]);
    if (max) s.maxLength = Number(max[1].replace(/_/g, ""));
    return s;
  }
  if (/consents|details|input|scores|criteria|components|evidence|meal|sleep/.test(f)) return { type: "object" };
  if (/polygon/.test(f)) return { type: "string", description: "JSON [[x,y], …] dalam piksel" };
  if (f === "email") return { type: "string", format: "email" };
  if (f === "password") return { type: "string", format: "password", minLength: 8 };
  if (f === "phone") return { type: "string", description: "Nomor WhatsApp, diawali 08" };
  if (f === "role") return { type: "string", enum: ["parent", "caregiver", "admin"], description: "Opsional. caregiver = Pengelola atau Pengasuh" };
  if (f === "terms") return { type: "boolean" };
  if (/_id$/.test(f)) return { type: "string", format: "uuid" };
  if (/_at$/.test(f)) return { type: "string", format: "date-time" };
  if (/_date$|_on$/.test(f)) return { type: "string", format: "date" };
  if (/^is_|^has_/.test(f)) return { type: "boolean" };
  return { type: "string" };
}

// ---------------------------------------------------------------- route
const routes = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p); else if (e === "route.js") routes.push(p);
  }
})(path.join(root, "app", "api"));

function tagsFor(url, key) {
  const ai = /\/ai\/|ai-draft|ai-read|\/triage$|\/activities\/\{id\}\/photos$/.test(url);
  const t = [];
  if (ai) t.push("Fitur AI");
  if (url.startsWith("/api/auth") || url.startsWith("/api/invitations")) t.push("Autentikasi & undangan");
  else if (url.startsWith("/api/daycares")) t.push("Katalog daycare (publik)");
  else if (url.startsWith("/api/me/daycares")) t.push("Pengelola daycare");
  else if (url.startsWith("/api/me") || url.startsWith("/api/notifications")) t.push("Akun & notifikasi");
  else if (url.startsWith("/api/children") || url.startsWith("/api/pickup")) t.push("Anak & penjemputan");
  else if (/activities/.test(url)) t.push("Catatan harian");
  else if (url.startsWith("/api/enrollments")) t.push("Pendaftaran & pembayaran");
  else if (url.startsWith("/api/incidents")) t.push("Insiden");
  else if (url.startsWith("/api/complaints")) t.push("Komplain");
  else if (url.startsWith("/api/reviews")) t.push("Ulasan");
  else if (url.startsWith("/api/admin") || url.includes("documents")) t.push("Admin & verifikasi");
  else if (!ai) t.push("Lainnya");
  void key;
  return t;
}

// Skema ditulis langsung (tanpa $ref) agar Swagger UI bisa membuka swagger.html dari berkas lokal.
const errorSchemaRef = { type: "object", required: ["code", "error"], properties: { code: { type: "string", example: "invalid_fields" }, error: { type: "string", example: "Isian permintaan tidak valid." } } };
const serverError = () => ({ description: "Kesalahan server. Detail database tidak pernah dikirim ke klien.", content: { "application/json": { schema: errorSchemaRef, example: { code: "internal_error", error: "Permintaan belum dapat diproses. Coba lagi beberapa saat." } } } });
const paths = {};
let opCount = 0;
for (const file of routes.sort()) {
  const src = readFileSync(file, "utf8");
  const url = "/" + path.relative(path.join(root, "app"), path.dirname(file)).split(path.sep).join("/").replace(/\[(\w+)\]/g, "{$1}");
  const imports = {};
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*"@\/(lib\/[^"]+)"/g)) {
    for (const n of m[1].split(",")) imports[n.trim().split(/\s+as\s+/).pop()] = m[2];
  }
  const pathParams = [...url.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
  for (const m of src.matchAll(/^export const (GET|POST|PATCH|PUT|DELETE)\s*=\s*apiRoute\(/gm)) {
    const method = m[1];
    let depth = 1, end = m.index + m[0].length;
    for (; end < src.length && depth; end++) { if (src[end] === "(") depth++; else if (src[end] === ")") depth--; }
    const args = src.slice(m.index + m[0].length, end - 1);
    const auth = args.split(",")[0].trim();
    const status = Number((/,\s*(\d{3})\s*$/.exec(args) ?? [])[1] ?? 200);
    const handler = Object.keys(imports).filter(n => imports[n].startsWith("lib/api/") && !["apiRoute"].includes(n)
      && new RegExp(`\\b${n}\\b`).test(args.slice(args.indexOf(",") + 1)))[0];
    const info = handler ? analyse(imports[handler], handler) : { body: null, multipart: null, query: new Set(), errors: new Set(), props: {} };
    if (/searchParams/.test(args)) for (const q of info.query) info.query.add(q);
    const key = `${method} ${url}`;
    const meta = META[key] ?? { access: "Login", description: "" };
    const isPublic = auth !== "authenticate";
    const summary = meta.summary ?? meta.description.replace(/\*\*/g, "").replace(/`/g, "").split(/(?<=[.;:])\s|\s\(|;/)[0].slice(0, 90).replace(/[.;:]$/, "");
    for (const q of meta.query ?? []) info.query.delete(q.name);
    const op = {
      tags: tagsFor(url, key),
      summary: summary || key,
      description: `**Akses:** ${meta.access}${isPublic ? " (tanpa login)" : ""}\n\n${meta.description}${handler ? `\n\nKode: \`${imports[handler]}.js\` → \`${handler}()\`` : ""}`,
      operationId: `${method.toLowerCase()}_${url.replace(/^\/api\//, "").replace(/[{}]/g, "").replace(/[^a-zA-Z0-9]+/g, "_")}`,
      parameters: [
        ...pathParams.map(p => ({ name: p, in: "path", required: true, schema: { type: "string" }, description: p === "id" && url.startsWith("/api/daycares/") ? "UUID atau slug daycare" : "UUID" })),
        ...(meta.query ?? []).map(q => ({ name: q.name, in: "query", required: Boolean(q.required), schema: { type: "string" }, description: q.description, ...(q.example ? { example: q.example } : {}) })),
        ...[...info.query].map(q => ({ name: q, in: "query", required: false, schema: { type: "string" } })),
      ],
      responses: {},
    };
    if (!isPublic) op.security = [{ bearerAuth: [] }, { cookieAuth: [] }];
    else op.security = [];
    const ex = EXAMPLES[key] ?? {};
    if (info.body || info.multipart || ex.request) {
      if (info.multipart) {
        const properties = Object.fromEntries((info.multipart.fields ?? []).map(f => [f, info.props[f] ?? {}]));
        if (info.multipart.file) properties.file = { type: "string", format: "binary", description: "Berkas yang diunggah; jenis dicek dari isi berkas (magic bytes), bukan dari nama" };
        op.requestBody = { required: true, content: { "multipart/form-data": { schema: { type: "object", properties, ...(info.multipart.file ? { required: ["file"] } : {}) } } } };
      } else {
        const fields = info.body?.fields ?? Object.keys(ex.request ?? {});
        const properties = Object.fromEntries(fields.map(f => [f, info.props[f] ?? {}]));
        op.requestBody = { required: !info.body?.optional, content: { "application/json": { schema: { type: "object", additionalProperties: false, properties, description: "Field di luar daftar ini ditolak dengan 400 invalid_fields." }, ...(ex.request ? { example: ex.request } : {}) } } };
      }
    }
    const okExample = ex.responses?.[status];
    op.responses[status] = { description: status === 201 ? "Berhasil dibuat" : "Berhasil", content: { "application/json": { schema: { type: "object" }, ...(okExample !== undefined ? { example: okExample } : {}) } } };
    // Error: dari kode handler + error umum
    const byStatus = {};
    const addErr = (code, msg, st) => { (byStatus[st] ??= []).push({ code, error: msg }); };
    for (const code of info.errors) {
      const e = errorStatus[code];
      if (e && e.status >= 400) addErr(code, e.message, e.status);
    }
    if (op.requestBody?.content?.["application/json"]) { addErr("invalid_fields", "Isian permintaan tidak valid.", 400); addErr("invalid_content_type", "Kirim data dalam format JSON.", 415); }
    if (!isPublic) addErr("not_authenticated", "Sesi login berakhir. Masuk kembali lalu coba lagi.", 401);
    if (method !== "GET") addErr("invalid_origin", "Permintaan dari situs lain tidak diizinkan.", 403);
    for (const [st, ex2] of Object.entries(ex.responses ?? {})) if (Number(st) >= 400) byStatus[st] = [ex2, ...(byStatus[st] ?? []).filter(x => x.code !== ex2.code)];
    for (const st of Object.keys(byStatus).sort()) {
      const list = byStatus[st];
      op.responses[st] = {
        description: list.map(x => `\`${x.code}\``).join(", "),
        content: { "application/json": { schema: errorSchemaRef, examples: Object.fromEntries(list.slice(0, 8).map(x => [x.code, { value: x }])) } },
      };
    }
    op.responses[500] = serverError();
    if (!op.parameters.length) delete op.parameters;
    (paths[url] ??= {})[method.toLowerCase()] = op;
    opCount++;
  }
}

const TAGS = [
  ["Fitur AI", "Endpoint yang memakai AI: Foto Fokus Anak (computer vision), draf catatan harian, baca dokumen legal (OCR + model bahasa), dan triage urgensi insiden. Semua hasil AI berupa usulan berlabel AI yang ditinjau manusia."],
  ["Autentikasi & undangan", "Daftar, masuk, keluar, dan menerima undangan staf."],
  ["Katalog daycare (publik)", "Pencarian, detail, perbandingan, layanan, foto, dan ulasan daycare. Tanpa login."],
  ["Akun & notifikasi", "Profil pengguna, penugasan Pengasuh, dan notifikasi."],
  ["Anak & penjemputan", "Profil anak, data kesehatan, dan izin penjemput."],
  ["Pendaftaran & pembayaran", "Pengajuan, keputusan Pengelola, penugasan, check-in, pembayaran QRIS, dan penjemputan."],
  ["Catatan harian", "Catatan kegiatan, foto, love, komentar, dan tanda sudah dibaca."],
  ["Insiden", "Laporan insiden, urgensi, bukti, dan tanda sudah dibaca Orang Tua."],
  ["Komplain", "Komplain Orang Tua dan lampirannya."],
  ["Ulasan", "Ulasan Orang Tua dan balasan Pengelola."],
  ["Pengelola daycare", "Profil, layanan dan harga, dokumen, foto, staf, dan delegasi milik Pengelola."],
  ["Admin & verifikasi", "Mitra, verifikasi dokumen, Safety Score, moderasi, pembayaran, komplain, investigasi, dan sanksi."],
];

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Ayomi API",
    version: "1.0.0",
    description: [
      "REST API Ayomi dibuat dengan **Next.js Route Handlers** (`app/api/`). Validasi dan logika ada di `lib/api/`; hak akses ditegakkan di fungsi database Supabase dan **Row Level Security**.",
      "",
      "**Autentikasi.** Endpoint bertanda gembok butuh login. Untuk mencoba di halaman ini: panggil `POST /api/auth/login`, salin `session.access_token`, lalu tekan **Authorize** dan tempel token itu (Bearer). Di browser, sesi juga dibaca dari cookie.",
      "",
      "**Peran** (Orang Tua, Pengelola, Pengasuh, Admin) dibaca dari database, bukan dari request. Mengganti ID di URL atau body tidak menaikkan hak akses; data milik akun lain dijawab `404`.",
      "",
      "**Konvensi.** Body JSON dengan `Content-Type: application/json` (selain itu `415`), kecuali unggahan `multipart/form-data`. Field yang tidak dikenal ditolak (`400 invalid_fields`). Request `POST`/`PATCH`/`PUT`/`DELETE` dari situs lain ditolak (`403 invalid_origin`). Header opsional `Idempotency-Key` (12–100 karakter) mencegah data ganda saat dikirim ulang. Semua respons memakai `Cache-Control: private, no-store`.",
      "",
      "**Format error** selalu `{ \"code\": \"...\", \"error\": \"pesan untuk pengguna\" }`. Kode error per endpoint di halaman ini diambil otomatis dari kode handler; kode yang berasal dari fungsi database tercantum di `lib/api/errors.js`.",
      "",
      `Dibuat otomatis oleh \`scripts/generate-openapi.mjs\` dari ${opCount} metode di ${Object.keys(paths).length} route.`,
    ].join("\n"),
  },
  servers: [{ url: PRODUCTION, description: "Production (Vercel)" }, { url: "http://localhost:3000", description: "Lokal (npm run dev)" }],
  tags: TAGS.map(([name, description]) => ({ name, description })),
  paths: Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b))),
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "session.access_token dari POST /api/auth/login" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "sb-<project>-auth-token", description: "Cookie sesi Supabase yang ditulis saat masuk lewat browser" },
    },
    schemas: { Error: { type: "object", required: ["code", "error"], properties: { code: { type: "string", example: "invalid_fields" }, error: { type: "string", example: "Isian permintaan tidak valid." } } } },
  },
};

writeFileSync(path.join(outDir, "openapi.json"), JSON.stringify(spec, null, 2) + "\n");
const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ayomi API</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css">
<style>body{margin:0;background:#fff}</style>
</head>
<body>
<div id="swagger"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js"></script>
<script>
// Spesifikasi disematkan agar halaman ini bisa dibuka langsung dari berkas (tanpa server).
const spec = ${JSON.stringify(spec).replace(/</g, "\\u003c")};
window.ui = SwaggerUIBundle({ spec, dom_id: "#swagger", deepLinking: true, docExpansion: "none",
  defaultModelsExpandDepth: -1, tagsSorter: (a, b) => spec.tags.findIndex(t => t.name === a) - spec.tags.findIndex(t => t.name === b),
  persistAuthorization: true, tryItOutEnabled: false });
</script>
</body>
</html>
`;
writeFileSync(path.join(outDir, "swagger.html"), html);
const withBody = Object.values(paths).flatMap(Object.values).filter(o => o.requestBody).length;
console.log(`${opCount} metode, ${Object.keys(paths).length} route, ${withBody} dengan body, ${Object.keys(EXAMPLES).length} contoh`);
if (!existsSync(path.join(outDir, "openapi.json"))) process.exit(1);
