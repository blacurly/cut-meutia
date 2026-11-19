import { ApiError } from "./http.js";
import { databaseData } from "./parent.js";
import {
  LISTING_COLUMNS, MAX_COMPARE, buildComparison, filterDirectoryDaycares, isDaycareKey, isUuid,
  mergeDirectory, parseDirectoryFilters, toDirectoryDaycare, toListingDaycare,
} from "../daycare-directory.js";
import { publicSafetyScore } from "./safety-score.js";

const notFound = () => { throw new ApiError(404, "daycare_not_found", "Daycare tidak ditemukan."); };

const GALLERY_BUCKET = "daycare-gallery";
const PHOTO_URL_SECONDS = 60 * 60;

// Photos the manager uploaded and Admin approved (048/049). The bucket is
// private; RLS lets anyone read approved photos of active daycares, so a
// short-lived signed URL is created per request. A failure here never breaks
// the page: the daycare then shows its other photos or example pictures.
export async function approvedPhotos(supabase, daycareId) {
  if (!daycareId) return [];
  try {
    const rows = databaseData(await supabase.rpc("app_list_public_daycare_photos", { p_daycare_id: daycareId }));
    const paths = (Array.isArray(rows) ? rows : []).map(row => row?.path).filter(Boolean);
    if (!paths.length) return [];
    const { data, error } = await supabase.storage.from(GALLERY_BUCKET).createSignedUrls(paths, PHOTO_URL_SECONDS);
    if (error) throw error;
    return (data || []).filter(item => item?.signedUrl && !item.error).map(item => ({ url: item.signedUrl, illustration: false }));
  } catch (error) {
    console.warn("[directory] approved photos unavailable", { daycareId, code: error?.code ?? error?.name });
    return [];
  }
}

const withPhotos = (supabase, partners, illustrations) => Promise.all((partners || []).map(async partner =>
  toDirectoryDaycare(partner, { approvedPhotos: await approvedPhotos(supabase, partner.id), illustrations })));

// GET /api/daycares — public catalog for everyone.
// Partner rows come from a SECURITY DEFINER RPC that returns only catalog-safe
// fields, never from a table-wide daycares SELECT. Optional query filters: q,
// province, city, district,
// facilities, legal, minRating, maxFee, maxRatio, ageMonths, sort. Unknown or
// invalid filter values are ignored, never an error.
// `illustrations` overrides the example-picture pool (tests).
export async function listDirectory({ supabase }, { mediaBaseUrl, searchParams, illustrations } = {}) {
  const listings = databaseData(await supabase.from("daycare_listings")
    .select(LISTING_COLUMNS).eq("visibility", "published").order("name"));
  const partners = databaseData(await supabase.rpc("app_list_public_daycares"));
  const merged = mergeDirectory(
    await withPhotos(supabase, partners, illustrations),
    (listings || []).map(row => toListingDaycare(row, { mediaBaseUrl, illustrations })),
  );
  return filterDirectoryDaycares(parseDirectoryFilters(searchParams ?? {}), merged);
}

// GET /api/daycares/{id} — by UUID or slug. Catalog entries are public;
// partner rows use a field-limited database RPC.
export async function getDaycareDetail({ supabase }, key, { mediaBaseUrl, illustrations } = {}) {
  if (!isDaycareKey(key)) throw new ApiError(400, "invalid_daycare_id", "ID atau slug daycare tidak valid.");
  const column = isUuid(key) ? "id" : "slug";
  const listings = databaseData(await supabase.from("daycare_listings")
    .select(LISTING_COLUMNS).eq(column, key).eq("visibility", "published").limit(1));
  if (listings?.length) {
    const claimedId = listings[0].claimed_daycare_id;
    // Online enrollment only while the linked partner daycare is active; the
    // public RPC returns nothing for inactive or suspended partners.
    const linked = claimedId
      ? databaseData(await supabase.rpc("app_get_public_daycare", { p_daycare_id: claimedId, p_slug: null }))
      : null;
    const [photos, safetyScore] = linked
      ? await Promise.all([approvedPhotos(supabase, claimedId), publicSafetyScore(supabase, claimedId)])
      : [[], null];
    const listing = toListingDaycare(listings[0], { mediaBaseUrl, illustrations, approvedPhotos: photos });
    return { ...listing, acceptsEnrollment: Boolean(linked), safetyScore };
  }
  const partner = databaseData(await supabase.rpc("app_get_public_daycare", {
    p_daycare_id: column === "id" ? key : null,
    p_slug: column === "slug" ? key : null,
  }));
  if (partner) {
    const [photos, safetyScore] = await Promise.all([approvedPhotos(supabase, partner.id), publicSafetyScore(supabase, partner.id)]);
    return { ...toDirectoryDaycare(partner, { approvedPhotos: photos, illustrations }), safetyScore };
  }
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
