import { ApiError } from "./http.js";
import { databaseData } from "./parent.js";
import {
  LISTING_COLUMNS, MAX_COMPARE, buildComparison, filterDirectoryDaycares, isDaycareKey, isUuid,
  mergeDirectory, parseDirectoryFilters, toDirectoryDaycare, toListingDaycare,
} from "../daycare-directory.js";

const notFound = () => { throw new ApiError(404, "daycare_not_found", "Daycare tidak ditemukan."); };

// GET /api/daycares (alias /api/daycare/list) — public catalog for everyone.
// Partner rows come from a SECURITY DEFINER RPC that returns only catalog-safe
// fields, never from a table-wide daycares SELECT. Optional query filters: q,
// province, city, district,
// facilities, legal, minRating, maxFee, maxRatio, ageMonths, sort. Unknown or
// invalid filter values are ignored, never an error.
export async function listDirectory({ supabase }, { mediaBaseUrl, searchParams } = {}) {
  const listings = databaseData(await supabase.from("daycare_listings")
    .select(LISTING_COLUMNS).eq("visibility", "published").order("name"));
  const partners = databaseData(await supabase.rpc("app_list_public_daycares"));
  const merged = mergeDirectory(
    (partners || []).map(toDirectoryDaycare),
    (listings || []).map(row => toListingDaycare(row, { mediaBaseUrl })),
  );
  return filterDirectoryDaycares(parseDirectoryFilters(searchParams ?? {}), merged);
}

// GET /api/daycares/{id} — by UUID or slug. Catalog entries are public;
// partner rows use a field-limited database RPC.
export async function getDaycareDetail({ supabase }, key, { mediaBaseUrl } = {}) {
  if (!isDaycareKey(key)) throw new ApiError(400, "invalid_daycare_id", "ID atau slug daycare tidak valid.");
  const column = isUuid(key) ? "id" : "slug";
  const listings = databaseData(await supabase.from("daycare_listings")
    .select(LISTING_COLUMNS).eq(column, key).eq("visibility", "published").limit(1));
  if (listings?.length) return toListingDaycare(listings[0], { mediaBaseUrl });
  const partner = databaseData(await supabase.rpc("app_get_public_daycare", {
    p_daycare_id: column === "id" ? key : null,
    p_slug: column === "slug" ? key : null,
  }));
  if (partner) return toDirectoryDaycare(partner);
  return notFound();
}

// GET /api/daycares/compare?ids=a,b,c — 2 to 3 daycares (UUID or slug),
// side by side. Values marked "estimated" come from synthetic profiles.
export async function compareDaycares(context, searchParams, options = {}) {
  const raw = (searchParams?.get("ids") || "").split(",").map(value => value.trim()).filter(Boolean);
  const keys = [...new Set(raw)];
  if (keys.length < 2 || keys.length > MAX_COMPARE || raw.length !== keys.length) {
    throw new ApiError(400, "invalid_compare_ids", `Pilih 2 sampai ${MAX_COMPARE} daycare yang berbeda (ids=a,b,c).`);
  }
  const daycares = [];
  for (const key of keys) daycares.push(await getDaycareDetail(context, key, options));
  return {
    daycares: daycares.map(({ id, slug, name, kind, district, city, province, coverImageUrl, coverIsIllustration }) =>
      ({ id, slug, name, kind, district, city, province, coverImageUrl, coverIsIllustration })),
    rows: buildComparison(daycares),
    notes: [
      "Status legalitas dan rating berasal dari sumber publik dan belum diverifikasi tim Ayomi.",
      ...(daycares.some(daycare => daycare.profile?.estimated)
        ? ["Baris bertanda estimasi memakai data sintetis untuk pengembangan, bukan informasi resmi daycare."] : []),
    ],
  };
}
