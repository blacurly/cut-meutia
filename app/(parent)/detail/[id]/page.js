import { cache } from "react";
import { notFound } from "next/navigation";
import ListingDetail from "@/components/features/ListingDetail";
import { createClient } from "@/lib/supabase/server";
import { getDaycareDetail } from "@/lib/api/directory";
import { isDaycareKey } from "@/lib/daycare-directory";

// Catalog and active partner daycares from Supabase (by slug or UUID).
const loadDaycare = cache(async id => {
  if (!isDaycareKey(id)) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return await getDaycareDetail({ supabase, user: data?.user ?? null }, id, { mediaBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });
  } catch (error) {
    if (error?.status === 404 || error?.status === 400) return null;
    throw error;
  }
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  const daycare = await loadDaycare(id);
  return {
    title: `${daycare?.name || "Daycare tidak ditemukan"} | Ayomi`,
    ...(daycare?.description ? { description: daycare.description.slice(0, 160) } : {}),
  };
}

export default async function DetailPage({ params }) {
  const { id } = await params;
  const daycare = await loadDaycare(id);
  if (!daycare) notFound();
  return <ListingDetail daycare={daycare} />;
}
