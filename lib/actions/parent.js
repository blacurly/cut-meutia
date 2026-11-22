"use server";

// Server Actions for the parent profile page (/profil): update the parent's
// profile and add a child. Route Handlers (PATCH /api/me, POST /api/children)
// stay the REST API for other clients; both paths call the same functions in
// lib/api/parent.js, so validation and the Supabase database functions are
// identical. The Supabase client carries the signed-in user's session from
// cookies, so RLS and the role checks in the database still apply.
//
// Actions return { ok: true, ...data } or { ok: false, status, code, error }
// instead of throwing: Next.js hides thrown error messages in production, and
// the form needs the user-facing message. Next.js already rejects calls from
// other origins (CSRF check).
import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/http";
import { CHILD_FIELDS, PROFILE_FIELDS, addChild, saveParentProfile } from "@/lib/api/parent";

async function signedIn() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new ApiError(401, "not_authenticated", "Sesi login berakhir. Masuk kembali lalu coba lagi.");
  return { supabase, user: data.user };
}

// Same rule as readObject(): a plain object with known fields only.
function fields(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) {
    throw new ApiError(400, "invalid_fields", "Isian permintaan tidak valid.");
  }
  return input;
}

async function run(name, work) {
  try {
    return { ok: true, ...(await work(await signedIn())) };
  } catch (error) {
    if (error instanceof ApiError && error.status < 500) {
      return { ok: false, status: error.status, code: error.code, error: error.message };
    }
    console.error(`[action] ${name} → ${error?.code ?? error?.name ?? "Error"}: ${error?.message ?? error}`);
    return { ok: false, status: 500, code: "internal_error", error: "Permintaan belum dapat diproses. Coba lagi beberapa saat." };
  }
}

export async function updateProfileAction(input) {
  return run("updateProfile", context => saveParentProfile(context, fields(input, PROFILE_FIELDS)));
}

export async function addChildAction(input) {
  return run("addChild", context => addChild(context, fields(input, CHILD_FIELDS)));
}
