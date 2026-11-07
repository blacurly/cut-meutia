import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/beranda";
  const allowedDestinations = new Set(["/beranda", "/atur-ulang-sandi"]);
  const safeNext = allowedDestinations.has(next) ? next : "/beranda";
  const recoveryFlow = safeNext === "/atur-ulang-sandi";

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
    } catch {
      // Missing configuration or a temporary Auth failure uses the safe error redirect below.
    }
  }

  return NextResponse.redirect(new URL(
    recoveryFlow ? "/masuk?auth=recovery-expired" : "/masuk?auth=confirmation-error",
    requestUrl.origin,
  ));
}
