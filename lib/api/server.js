import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { makeAuthenticate, makeOptionalAuthenticate } from "./http.js";

const clients = {
  cookieClient: createCookieClient,
  bearerClient: token => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase is not configured.");
    return createSupabaseClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  },
};

export const authenticate = makeAuthenticate(clients);
export const authenticateOptional = makeOptionalAuthenticate(clients);
