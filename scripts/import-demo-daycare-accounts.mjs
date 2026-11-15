#!/usr/bin/env node
// Local provisioning for the Ayomi demo catalog. Preview-only unless --apply is passed.
// Run from the repository root. Never prints credentials, emails, or API keys.

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const root = path.resolve(valueAfter("--project-root", process.cwd()));
const csvPath = path.resolve(valueAfter("--csv", path.join(root, "..", "Downloads", "Akun_Demo_Daycare_Sederhana.csv")));
const envPath = path.join(root, ".env.local");
const projectUrl = "https://uitkyzjezowynbedjkbw.supabase.co";
const verifierEmail = "ayomi-demo-seed-verifier@ayomi.test";
const accountRoles = new Map([
  ["manager", "manager"],
  ["caregiver 1", "caregiver"],
  ["caregiver 2", "caregiver"],
]);

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
    } else field += character;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [rawHeaders, ...values] = rows;
  if (!rawHeaders) throw new Error("CSV is empty.");
  const headers = rawHeaders.map(value => value.replace(/^\uFEFF/, "").trim());
  return values.map(cells => Object.fromEntries(headers.map((key, index) => [key, (cells[index] ?? "").trim()])));
}

function normalize(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .replace(/\b(kota|kabupaten|kab|kec|kecamatan|daycare|day care|childcare|child care|tpa)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

function parseEnv(source) {
  const result = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    result[match[1]] = value;
  }
  return result;
}

function safeFailure(operation, status, code = "") {
  throw new Error(`${operation} failed (HTTP ${status}${code ? `, ${code}` : ""}).`);
}

async function createApi(url, secret) {
  const base = url.replace(/\/+$/, "");
  async function request(endpoint, { method = "GET", body, prefer, operation }) {
    const headers = {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(prefer ? { Prefer: prefer } : {}),
    };
    let response;
    try {
      response = await fetch(`${base}${endpoint}`, {
        method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new Error(`${operation} failed: network request could not be completed.`);
    }
    const raw = await response.text();
    let result = null;
    if (raw) { try { result = JSON.parse(raw); } catch { result = null; } }
    if (!response.ok) safeFailure(operation, response.status, result?.code || result?.error_code || "");
    return result;
  }

  return {
    select(table, params, operation) {
      return request(`/rest/v1/${table}?${new URLSearchParams(params)}`, { operation });
    },
    upsert(table, rows, conflict, operation) {
      return request(`/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
        method: "POST", body: rows, prefer: "resolution=merge-duplicates,return=minimal", operation,
      });
    },
    insert(table, rows, operation) {
      return request(`/rest/v1/${table}`, {
        method: "POST", body: rows, prefer: "return=representation", operation,
      });
    },
    update(table, filters, body, operation) {
      return request(`/rest/v1/${table}?${new URLSearchParams(filters)}`, {
        method: "PATCH", body, prefer: "return=minimal", operation,
      });
    },
    async listAuthUsers(page) {
      const result = await request(`/auth/v1/admin/users?page=${page}&per_page=1000`, { operation: "Checking Auth users" });
      return result?.users ?? [];
    },
    async createAuthUser(attributes) {
      const result = await request("/auth/v1/admin/users", { method: "POST", body: attributes, operation: "Creating a demo Auth user" });
      return result?.user ?? result;
    },
  };
}

async function fetchAll(api, table, params, operation) {
  const output = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await api.select(table, { ...params, limit: 1000, offset }, operation);
    output.push(...(page ?? []));
    if (!page || page.length < 1000) return output;
  }
}

function uniqueMatch(account, listings) {
  const name = normalize(account["Nama daycare"]);
  const province = normalize(account.Provinsi);
  const city = normalize(account["Kota/Kabupaten"]);
  const sameProvince = listing => normalize(listing.province_name) === province;
  let matches = listings.filter(listing => normalize(listing.name) === name
    && normalize(listing.city_name) === city && sameProvince(listing));
  if (matches.length === 1) return { listing: matches[0], matchType: "name+city+province" };
  if (matches.length > 1) return { ambiguous: true };
  matches = listings.filter(listing => normalize(listing.name) === name && sameProvince(listing));
  if (matches.length === 1) return { listing: matches[0], matchType: "name+province" };
  return { ambiguous: matches.length > 1 };
}

async function main() {
  const env = { ...process.env, ...parseEnv(await readFile(envPath, "utf8")) };
  const secret = env.SUPABASE_SECRET_KEY;
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || projectUrl;
  if (!secret) throw new Error("Missing SUPABASE_SECRET_KEY in the local environment file.");
  const api = await createApi(url, secret);

  const accounts = parseCsv(await readFile(csvPath, "utf8"));
  const required = ["Kode daycare", "Provinsi", "Kota/Kabupaten", "Kecamatan", "Nama daycare", "Role", "Email demo", "Password sementara"];
  if (required.some(column => !Object.hasOwn(accounts[0] ?? {}, column))) throw new Error("CSV headers do not match the expected account file.");

  const groups = new Map();
  for (const account of accounts) {
    const code = account["Kode daycare"];
    const role = accountRoles.get(account.Role.trim().toLocaleLowerCase("id-ID"));
    if (!code || !role || !account["Email demo"] || !account["Password sementara"]) throw new Error("CSV contains an incomplete or unsupported account row.");
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push({ ...account, appRole: role, email: account["Email demo"].trim().toLowerCase() });
  }
  for (const [code, group] of groups) {
    const roles = group.map(row => row.appRole).sort();
    if (group.length !== 3 || roles.join(",") !== "caregiver,caregiver,manager") throw new Error(`Daycare ${code} does not have exactly one Manager and two Caregivers.`);
  }
  const emails = accounts.map(row => row["Email demo"].trim().toLowerCase());
  if (new Set(emails).size !== emails.length) throw new Error("CSV contains duplicate demo emails.");

  const listings = await fetchAll(api, "daycare_listings", {
    select: "id,slug,name,province_code,province_name,city_name,district_name,address,postal_code,facility_tags,visibility,claimed_daycare_id",
    visibility: "eq.published", order: "name.asc",
  }, "Reading published daycare listings");
  const ids = listings.map(listing => listing.id);
  const profiles = ids.length ? await fetchAll(api, "daycare_listing_profiles", {
    select: "listing_id,daily_capacity,opening_time,closing_time,operating_days,data_origin",
    listing_id: `in.(${ids.join(",")})`,
  }, "Reading listing profiles") : [];
  const profileByListing = new Map(profiles.map(profile => [profile.listing_id, profile]));

  const matches = [];
  const unmatched = [];
  const ambiguous = [];
  for (const [code, group] of groups) {
    const result = uniqueMatch(group[0], listings);
    if (result.ambiguous) ambiguous.push(code);
    else if (!result.listing) unmatched.push({ code, name: group[0]["Nama daycare"] });
    else matches.push({ code, accounts: group, listing: result.listing, matchType: result.matchType, profile: profileByListing.get(result.listing.id) });
  }
  if (ambiguous.length) throw new Error(`Ambiguous daycare match for code(s): ${ambiguous.join(", ")}.`);
  if (new Set(matches.map(item => item.listing.id)).size !== matches.length) throw new Error("Multiple CSV daycare codes map to the same catalog listing.");
  if (matches.some(item => !item.profile || Number(item.profile.daily_capacity) < 1)) throw new Error("A matched listing has no usable demo capacity profile.");

  const existingAuth = [];
  for (let page = 1; ; page += 1) {
    const users = await api.listAuthUsers(page);
    existingAuth.push(...users);
    if (users.length < 1000) break;
  }
  const authByEmail = new Map(existingAuth.map(user => [String(user.email ?? "").toLowerCase(), user]));
  const conflicts = [];
  for (const { code, accounts: group } of matches) {
    for (const account of group) {
      const user = authByEmail.get(account.email);
      if (user && (user.user_metadata?.ayomi_demo_seed !== true
        || user.user_metadata?.daycare_code !== code || user.user_metadata?.daycare_role !== account.appRole)) conflicts.push(account.email);
    }
  }
  if (authByEmail.has(verifierEmail) && authByEmail.get(verifierEmail).user_metadata?.ayomi_demo_verifier !== true) conflicts.push(verifierEmail);
  if (conflicts.length) throw new Error(`${conflicts.length} email(s) belong to non-demo Auth users; no changes were made.`);

  const accountCount = matches.reduce((count, item) => count + item.accounts.length, 0);
  console.log(`Mode: ${apply ? "APPLY" : "PREVIEW ONLY"}`);
  console.log(`Published catalog listings: ${listings.length}`);
  console.log(`CSV daycare codes: ${groups.size}; matched: ${matches.length}; linked role accounts: ${accountCount}`);
  console.log(`Name, city, province matches: ${matches.filter(item => item.matchType === "name+city+province").length}`);
  console.log(`Name and province fallback matches: ${matches.filter(item => item.matchType === "name+province").length}`);
  console.log(`Held unmatched: ${unmatched.map(item => item.code).join(", ") || "none"}`);
  console.log(`Already-created matching Auth accounts: ${matches.flatMap(item => item.accounts).filter(account => authByEmail.has(account.email)).length}`);
  if (!apply) { console.log("No changes made. Add --apply to perform the import."); return; }

  // The inactive synthetic Admin profile provides the verified_by FK actor for
  // demo records. Its cryptographically random password stays in memory only.
  let verifier = authByEmail.get(verifierEmail);
  if (!verifier) {
    verifier = await api.createAuthUser({
      email: verifierEmail, password: randomBytes(48).toString("base64url"), email_confirm: true,
      user_metadata: { full_name: "Ayomi demo seed verifier", ayomi_demo_verifier: true },
    });
  }
  if (!verifier?.id) throw new Error("Internal demo verifier could not be initialized.");
  await api.upsert("users", [{ id: verifier.id, role: "admin", full_name: "Ayomi demo seed verifier", status: "inactive" }], "id", "Saving internal demo verifier profile");

  let createdAuthCount = 0;
  const userIds = new Map();
  for (const item of matches) {
    for (const account of item.accounts) {
      let user = authByEmail.get(account.email);
      if (!user) {
        user = await api.createAuthUser({
          email: account.email, password: account["Password sementara"], email_confirm: true,
          user_metadata: {
            full_name: `${account["Nama daycare"]} — ${account.Role}`,
            ayomi_demo_seed: true, daycare_code: item.code, daycare_role: account.appRole,
          },
        });
        createdAuthCount += 1;
        authByEmail.set(account.email, user);
      }
      userIds.set(`${item.code}:${account.Role}`, user.id);
    }
  }
  const profileRows = matches.flatMap(item => item.accounts.map(account => ({
    id: userIds.get(`${item.code}:${account.Role}`), role: account.appRole,
    full_name: `${account["Nama daycare"]} — ${account.Role}`, status: "active", deleted_at: null,
  })));
  for (let index = 0; index < profileRows.length; index += 100) {
    await api.upsert("users", profileRows.slice(index, index + 100), "id", "Setting demo account roles");
  }

  const currentDaycares = await fetchAll(api, "daycares", {
    select: "id,slug,name,status,main_manager_id",
  }, "Checking current partner daycares");
  const daycareBySlug = new Map(currentDaycares.map(daycare => [daycare.slug, daycare]));
  const daycareById = new Map(currentDaycares.map(daycare => [daycare.id, daycare]));
  const daycareIds = new Map();
  const newPartners = [];
  for (const item of matches) {
    const manager = item.accounts.find(account => account.appRole === "manager");
    const managerId = userIds.get(`${item.code}:${manager.Role}`);
    const slug = `demo-${item.listing.slug}`;
    const partner = item.listing.claimed_daycare_id ? daycareById.get(item.listing.claimed_daycare_id) : daycareBySlug.get(slug);
    if (item.listing.claimed_daycare_id && !partner) throw new Error(`Claimed listing ${item.code} points to a missing partner row.`);
    if (partner && normalize(partner.name) !== normalize(item.listing.name)) throw new Error(`Partner slug collision for ${item.code}.`);
    if (partner?.main_manager_id && partner.main_manager_id !== managerId) throw new Error(`Partner ${item.code} already has a different Manager account.`);
    if (partner) { daycareIds.set(item.code, partner.id); continue; }

    const district = manager.Kecamatan || item.listing.district_name || "Belum ditentukan";
    newPartners.push({ source: item, slug, row: {
      slug, name: item.listing.name,
      description: "Profil daycare demo aktif. Data operasional dan kapasitas mengikuti estimasi katalog Ayomi.",
      address: item.listing.address,
      province_code: item.listing.province_name,
      city_code: item.listing.city_name,
      district_code: district,
      postal_code: item.listing.postal_code,
      timezone: "Asia/Jakarta", contact_phone: "",
      facilities: item.listing.facility_tags ?? [],
      opening_hours: { days: item.profile.operating_days, opens_at: item.profile.opening_time, closes_at: item.profile.closing_time },
      public_gallery: [], daily_capacity: Number(item.profile.daily_capacity),
      status: "inactive", main_manager_id: null,
    } });
  }

  for (let index = 0; index < newPartners.length; index += 50) {
    const chunk = newPartners.slice(index, index + 50);
    const inserted = await api.insert("daycares", chunk.map(item => item.row), "Creating demo partner daycares");
    for (const partner of inserted ?? []) {
      daycareBySlug.set(partner.slug, partner); daycareById.set(partner.id, partner);
      const source = chunk.find(item => item.slug === partner.slug)?.source;
      if (source) daycareIds.set(source.code, partner.id);
    }
  }
  for (const item of matches) {
    if (!daycareIds.has(item.code)) {
      const partner = daycareBySlug.get(`demo-${item.listing.slug}`);
      if (partner) daycareIds.set(item.code, partner.id);
    }
  }

  const memberRows = [];
  const activationUpdates = [];
  const listingClaims = [];
  for (const item of matches) {
    const daycareId = daycareIds.get(item.code);
    if (!daycareId) throw new Error(`Partner daycare ${item.code} was not created or found.`);
    const manager = item.accounts.find(account => account.appRole === "manager");
    const managerId = userIds.get(`${item.code}:${manager.Role}`);
    for (const account of item.accounts) {
      const now = new Date().toISOString();
      memberRows.push({
        daycare_id: daycareId, user_id: userIds.get(`${item.code}:${account.Role}`),
        member_role: account.appRole, status: "active", verified_by: verifier.id,
        verified_at: now, joined_at: now, ended_at: null,
      });
    }
    activationUpdates.push({ id: daycareId, main_manager_id: managerId, status: "active" });
    listingClaims.push({ id: item.listing.id, partnerId: daycareId, currentClaim: item.listing.claimed_daycare_id });
  }
  for (let index = 0; index < memberRows.length; index += 100) {
    await api.upsert("daycare_members", memberRows.slice(index, index + 100), "daycare_id,user_id", "Activating demo daycare memberships");
  }
  for (const update of activationUpdates) {
    await api.update("daycares", { id: `eq.${update.id}` }, { main_manager_id: update.main_manager_id, status: "active" }, "Activating a demo daycare partner");
  }
  for (const claim of listingClaims) {
    if (claim.currentClaim && claim.currentClaim !== claim.partnerId) throw new Error("A listing is already linked to another partner; stopped before changing that listing link.");
    if (!claim.currentClaim) await api.update("daycare_listings", { id: `eq.${claim.id}`, claimed_daycare_id: "is.null" }, { claimed_daycare_id: claim.partnerId }, "Linking catalog listing to its active partner");
  }
  console.log(`Completed: ${matches.length} daycare partners active; ${memberRows.length} staff memberships active; ${createdAuthCount} Auth users created; ${unmatched.length} code(s) held.`);
  console.log("The demo verifier is inactive; its random password was not saved or displayed.");
  console.log("CSV has no contact phones, so new partner rows leave contact_phone blank for later completion.");
}

main().catch(error => {
  console.error(`Import stopped: ${String(error?.message ?? "unknown error").replace(/SUPABASE_SECRET_KEY\s*=\s*\S+/g, "SUPABASE_SECRET_KEY=[redacted]")}`);
  process.exitCode = 1;
});
