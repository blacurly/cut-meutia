import { databaseData } from "./parent.js";
import { LISTING_COLUMNS, PARTNER_COLUMNS, mergeDirectory, toDirectoryDaycare, toListingDaycare } from "../daycare-directory.js";

// GET /api/daycare/list — public catalog for everyone; partner daycares are
// added for signed-in users (their RLS read path requires a session).
export async function listDirectory({ supabase, user }, { mediaBaseUrl } = {}) {
  const listings = databaseData(await supabase.from("daycare_listings")
    .select(LISTING_COLUMNS).eq("visibility", "published").order("name"));
  const partners = user
    ? databaseData(await supabase.from("daycares")
      .select(PARTNER_COLUMNS).eq("status", "active").is("deleted_at", null).order("name"))
    : [];
  return mergeDirectory(
    (partners || []).map(toDirectoryDaycare),
    (listings || []).map(row => toListingDaycare(row, { mediaBaseUrl })),
  );
}
