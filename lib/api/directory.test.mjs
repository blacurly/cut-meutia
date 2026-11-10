import test from "node:test";
import assert from "node:assert/strict";
import { apiRoute, makeOptionalAuthenticate } from "./http.js";
import { listDirectory } from "./directory.js";

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

function client({ user = null, error = null } = {}) {
  const reads = [];
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
        then(resolve) {
          if (error) return Promise.resolve({ data: null, error }).then(resolve);
          return Promise.resolve({ data: tables[table].filter(row => predicates.every(match => match(row))), error: null }).then(resolve);
        },
      };
      return query;
    },
  };
}

const call = async (supabase, headers = {}) => {
  const authenticate = makeOptionalAuthenticate({ cookieClient: () => supabase, bearerClient: () => supabase });
  const response = await apiRoute(authenticate, context => listDirectory(context, { mediaBaseUrl: "https://abc.supabase.co" }))(
    new Request("http://localhost:3000/api/daycare/list", { headers }));
  return { response, data: await response.json() };
};

test("visitors without a session get the published catalog only", async () => {
  const supabase = client();
  const { response, data } = await call(supabase);
  assert.equal(response.status, 200);
  assert.deepEqual(data.map(d => d.id), ["listing-1"]);
  assert.deepEqual(supabase.reads, ["daycare_listings"]);
  assert.equal(data[0].coverImageUrl, "https://abc.supabase.co/storage/v1/object/public/daycare-public-media/rumah-biru/cover.webp");
});

test("signed-in users also see active partner daycares", async () => {
  const supabase = client({ user: { id: "parent" } });
  const { data } = await call(supabase);
  assert.deepEqual(data.map(d => d.id), ["partner-1", "listing-1"]);
  assert.deepEqual(supabase.reads, ["daycare_listings", "daycares"]);
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
