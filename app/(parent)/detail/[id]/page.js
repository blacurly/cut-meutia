import { cache } from "react";
import { notFound } from "next/navigation";
import DaycareDetail from "@/components/features/DaycareDetail";
import ListingDetail from "@/components/features/ListingDetail";
import { getDaycare } from "@/lib/parent";
import { createClient } from "@/lib/supabase/server";
import { getDaycareDetail } from "@/lib/api/directory";
import { isDaycareKey } from "@/lib/daycare-directory";

// Catalog daycares come from Supabase (by slug or UUID); the fictional demo
// profiles keep their local fixtures.
const loadDaycare = cache(async id => {
  const demo = getDaycare(id);
  if (demo) return { demo };
  if (!isDaycareKey(id)) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return { listing: await getDaycareDetail({ supabase, user: data?.user ?? null }, id, { mediaBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL }) };
  } catch (error) {
    if (error?.status === 404 || error?.status === 400) return null;
    throw error;
  }
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  const found = await loadDaycare(id);
  const daycare = found?.demo || found?.listing;
  return {
    title: `${daycare?.name || "Daycare tidak ditemukan"} | Ayomi`,
    ...(found?.listing ? { description: found.listing.description?.slice(0, 160) } : {}),
  };
}

export default async function DetailPage({ params }) {
  const { id } = await params;
  const found = await loadDaycare(id);
  if (!found) notFound();
  return found.demo ? <DaycareDetail daycare={found.demo} /> : <ListingDetail daycare={found.listing} />;
}
