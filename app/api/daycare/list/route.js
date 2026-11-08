import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { databaseData } from "@/lib/api/parent";
import { toDirectoryDaycare } from "@/lib/daycare-directory";

export const GET = apiRoute(authenticate, async ({ supabase }) => {
  const data = databaseData(await supabase.from("daycares")
    .select("id,slug,name,description,address,province_code,city_code,district_code,facilities,daily_capacity,status")
    .eq("status", "active").is("deleted_at", null).order("name"));
  return data.map(toDirectoryDaycare);
});
