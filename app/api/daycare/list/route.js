import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { toDirectoryDaycare } from "@/lib/daycare-directory";

export async function GET(request) {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  let supabase;

  if (bearerToken) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return Response.json(
        { error: "Supabase is not configured." },
        { status: 500 },
      );
    }

    supabase = createSupabaseClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: authError } = await supabase.auth.getUser(bearerToken);

    if (authError) {
      return Response.json(
        { error: "Invalid or expired access token." },
        { status: 401 },
      );
    }
  } else {
    supabase = await createCookieClient();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json(
      { error: "Silakan masuk untuk melihat direktori daycare." },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from("daycares")
    .select(
      "id,slug,name,description,address,province_code,city_code,district_code,facilities,daily_capacity,status",
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .order("name");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data.map(toDirectoryDaycare), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
