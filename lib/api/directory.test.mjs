import test from "node:test";
import assert from "node:assert/strict";
import { apiRoute, makeOptionalAuthenticate } from "./http.js";
import { compareDaycares, getDaycareDetail, listDirectory } from "./directory.js";

const listing = {
  id: "listing-1", slug: "rumah-biru", name: "Rumah Biru Daycare", province_name: "DKI Jakarta", city_name: "Jakarta Selatan",
  district_name: "Tebet", address: "Jl. Tebet", postal_code: "12810", facilities_text: "CCTV", facility_tags: ["cctv"],
  public_rating: 5, public_rating_source: "Rating publik", legal_status: "referenced", legal_reference: "NPSN 70054305",
  legal_reference_url: null, npsn: "70054305", data_quality_notes: [], cover_image_path: "rumah-biru/cover.webp",
  claimed_daycare_id: null, visibility: "published",
};
const hidden = { ...listing, id: "listing-2", name: "Hidden", visibility: "hidden" };
const partnerRow = {
  id: "partner-1", slug: "mitra", name: "Daycare Mitra", description: "", address: "Jl. Mitra", province_code: "35",
  city_code: "3578", district_code: "357801", facilities: [], daily_capacity: 10, status: "active", deleted_at: null,
};

function client({ user = null, error = null, photos = {} } = {}) {
  const reads = [];
  const signed = [];
  const tables = { daycare_listings: [listing, hidden], daycares: [partnerRow] };
  return {
    reads,
    auth: { async getUser(token) { return user || token === "valid" ? { data: { user: user || { id: "u" } }, error: null } : { data: { user: null }, error: new Error("Auth session missing!") }; } },
    from(table) {
      reads.push(table);
      const predicates = [];
      const query = {
        select() { return query; },
        eq(key, value) { predicates.push(row => row[key] === value); return query; },
        is(key, value) { predicates.push(row => (row[key] ?? null) === value); return query; },
        order() { return query; },
        limit() { return query; },
        then(resolve) {
          if (error) return Promise.resolve({ data: null, error }).then(resolve);
          return Promise.resolve({ data: tables[table].filter(row => predicates.every(match => match(row))), error: null }).then(resolve);
        },
      };
      return query;
    },
    rpc(name, args = {}) {
      if (name === "app_list_public_daycares") {
        return Promise.resolve({ data: tables.daycares.filter(row => row.status === "active"), error: null });
      }
      if (name === "app_get_public_daycare") {
        const row = tables.daycares.find(item => item.status === "active" &&
          (args.p_daycare_id ? item.id === args.p_daycare_id : item.slug === args.p_slug));
        return Promise.resolve({ data: row || null, error: null });
      }
      if (name === "app_list_public_daycare_photos") {
        return Promise.resolve({ data: (photos[args.p_daycare_id] || []).map(path => ({ path, caption: null, display_order: 0 })), error: null });
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
    storage: {
      from(bucket) {
        return {
          async createSignedUrls(paths, seconds) {
            signed.push({ bucket, paths, seconds });
            return { data: paths.map(path => ({ path, error: null, signedUrl: `https://abc.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=t` })), error: null };
          },
        };
      },
    },
    signed,
  };
}

const call = async (supabase, headers = {}) => {
  const authenticate = makeOptionalAuthenticate({ cookieClient: () => supabase, bearerClient: () => supabase });
  const response = await apiRoute(authenticate, context => listDirectory(context, { mediaBaseUrl: "https://abc.supabase.co" }))(
    new Request("http://localhost:3000/api/daycares", { headers }));
  return { response, data: await response.json() };
};

test("visitors without a session get published listings and active partner daycares", async () => {
  const supabase = client();
  const { response, data } = await call(supabase);
  assert.equal(response.status, 200);
  assert.deepEqual(data.map(d => d.id), ["partner-1", "listing-1"]);
  assert.deepEqual(supabase.reads, ["daycare_listings"]);
  assert.equal(data.find(d => d.id === "listing-1").coverImageUrl, "https://abc.supabase.co/storage/v1/object/public/daycare-public-media/rumah-biru/cover.webp");
});

test("approved manager photos become the partner's gallery through signed URLs", async () => {
  const supabase = client({ photos: { "partner-1": ["partner-1/a.webp", "partner-1/b.webp"] } });
  const { data } = await call(supabase);
  const partner = data.find(d => d.id === "partner-1");
  assert.equal(partner.coverIsIllustration, false);
  assert.deepEqual(partner.gallery.map(photo => photo.url), [
    "https://abc.supabase.co/storage/v1/object/sign/daycare-gallery/partner-1/a.webp?token=t",
    "https://abc.supabase.co/storage/v1/object/sign/daycare-gallery/partner-1/b.webp?token=t",
  ]);
  assert.deepEqual(supabase.signed, [{ bucket: "daycare-gallery", paths: ["partner-1/a.webp", "partner-1/b.webp"], seconds: 3600 }]);
  const detail = await getDaycareDetail(ctx(supabase), "mitra");
  assert.equal(detail.gallery.length, 2);
  assert.equal(detail.gallery[0].illustration, false);
});

test("signed-in users also see active partner daycares", async () => {
  const supabase = client({ user: { id: "parent" } });
  const { data } = await call(supabase);
  assert.deepEqual(data.map(d => d.id), ["partner-1", "listing-1"]);
  assert.deepEqual(supabase.reads, ["daycare_listings"]);
});

test("an invalid bearer token is rejected instead of silently treated as a visitor", async () => {
  const { response } = await call(client(), { Authorization: "Bearer expired" });
  assert.equal(response.status, 401);
});

test("database errors return a generic 500 without internal details", async () => {
  const { response, data } = await call(client({ error: { message: "relation daycare_listings does not exist" } }));
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(data).includes("relation"), false);
});

const LISTING_UUID = "11111111-1111-4111-8111-111111111111";
// Minimal query double with eq/is/limit filtering over fixed rows.
const withIds = () => {
  const rows = {
    daycare_listings: [
      { ...listing, id: LISTING_UUID, slug: "rumah-biru", profile: { data_origin: "synthetic", description: "Profil sintetis rumah biru.", monthly_fee_min: 2000000, monthly_fee_max: 2500000, daily_fee: 140000, registration_fee: 0, caregiver_ratio: 4, caregiver_count: 5, daily_capacity: 20, age_min_months: 6, age_max_months: 60, opening_time: "07:00:00", closing_time: "17:00:00", operating_days: "Senin–Jumat", packages: [], gallery_images: ["/images/daycare-room.webp"] } },
      { ...listing, id: "22222222-2222-4222-8222-222222222222", slug: "kasih-ibu", name: "Kasih Ibu", public_rating: 4.2 },
      { ...hidden, slug: "listing-2-hidden" },
    ],
    daycares: [],
  };
  return {
    from(table) {
      const filters = [];
      const query = {
        select() { return query; }, order() { return query; }, limit() { return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        is(key, value) { filters.push(row => (row[key] ?? null) === value); return query; },
        then(resolve) { return Promise.resolve({ data: rows[table].filter(row => filters.every(match => match(row))), error: null }).then(resolve); },
      };
      return query;
    },
    rpc(name, args = {}) {
      if (name === "app_list_public_daycares") return Promise.resolve({ data: rows.daycares, error: null });
      if (name === "app_get_public_daycare") {
        const row = rows.daycares.find(item => args.p_daycare_id ? item.id === args.p_daycare_id : item.slug === args.p_slug);
        return Promise.resolve({ data: row || null, error: null });
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
};
const ctx = supabase => ({ supabase, user: null });
const params = query => new URLSearchParams(query);

test("detail resolves by UUID or slug, hides unpublished and validates the key", async () => {
  const supabase = withIds();
  const byId = await getDaycareDetail(ctx(supabase), LISTING_UUID, { illustrations: [] });
  const bySlug = await getDaycareDetail(ctx(supabase), "rumah-biru");
  assert.equal(byId.id, bySlug.id);
  assert.equal(byId.monthlyFee, 2000000);
  assert.deepEqual(byId.gallery, [{ url: "/images/daycare-room.webp", illustration: true }]);
  await assert.rejects(getDaycareDetail(ctx(supabase), "listing-2-hidden"), error => error.status === 404 && error.code === "daycare_not_found");
  await assert.rejects(getDaycareDetail(ctx(supabase), "Bad Slug!"), error => error.status === 400 && error.code === "invalid_daycare_id");
});

test("compare needs 2–3 distinct daycares and returns rows plus honesty notes", async () => {
  const supabase = withIds();
  const result = await compareDaycares(ctx(supabase), params({ ids: `rumah-biru,${"22222222-2222-4222-8222-222222222222"}` }));
  assert.deepEqual(result.daycares.map(d => d.slug), ["rumah-biru", "kasih-ibu"]);
  const fee = result.rows.find(row => row.key === "monthly_fee");
  assert.match(fee.values[0].display, /^Rp\s2\.000\.000$/);
  assert.equal(fee.values[1].display, "Belum tersedia");
  assert.equal(result.notes.length, 2);
  for (const ids of ["rumah-biru", "a,b,c,d", "rumah-biru,rumah-biru", ""]) {
    await assert.rejects(compareDaycares(ctx(supabase), params({ ids })), error => error.code === "invalid_compare_ids", ids);
  }
  await assert.rejects(compareDaycares(ctx(supabase), params({ ids: "rumah-biru,tidak-ada" })), error => error.status === 404);
});

test("list applies server-side filters from the query string", async () => {
  const supabase = withIds();
  const all = await listDirectory(ctx(supabase), { searchParams: params({}) });
  assert.deepEqual(all.map(d => d.slug).sort(), ["kasih-ibu", "rumah-biru"]);
  const cheap = await listDirectory(ctx(supabase), { searchParams: params({ maxFee: "2000000" }) });
  assert.deepEqual(cheap.map(d => d.slug), ["rumah-biru"]);
});
