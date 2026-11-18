"use client";

// Signed-in user and their Ayomi profile (role, status, name), read from
// Supabase. Every portal uses it to decide what to show; the API still
// checks role and scope on every request.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const SessionContext = createContext(null);

export const ROLE_LABEL = { parent: "Orang Tua", manager: "Pengelola", caregiver: "Pengasuh", admin: "Administrator" };
export const homeFor = role => (role === "admin" ? "/admin" : role === "manager" || role === "caregiver" ? "/pengelola" : "/beranda");

export default function SessionProvider({ children }) {
  const supabase = useMemo(() => (isSupabaseConfigured() ? createClient() : null), []);
  const [session, setSession] = useState({ status: supabase ? "loading" : "signed-out", user: null, profile: null });

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    const user = data?.user ?? null;
    if (!user) { setSession({ status: "signed-out", user: null, profile: null }); return; }
    const { data: profile } = await supabase.from("users").select("role, status, full_name").eq("id", user.id).maybeSingle();
    setSession({ status: "signed-in", user, profile: profile ?? null });
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return undefined;
    Promise.resolve().then(load);
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) load();
    });
    return () => data.subscription.unsubscribe();
  }, [supabase, load]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSession({ status: "signed-out", user: null, profile: null });
  }, [supabase]);

  const value = useMemo(() => ({
    ...session,
    role: session.profile?.status === "active" ? session.profile.role : null,
    name: session.profile?.full_name || session.user?.email || "",
    reload: load,
    signOut,
  }), [session, load, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("SessionProvider diperlukan.");
  return context;
}
