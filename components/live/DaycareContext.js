"use client";

// Daycares where the signed-in user is an active Manager or Caregiver
// (GET /api/me/daycares). Staff pages read the selected one from here.
import { createContext, useContext, useMemo, useState } from "react";
import { useApi } from "@/lib/client-api";
import { Empty, ErrorNote, Loading } from "./ui";

const DaycareContext = createContext(null);
const STORAGE_KEY = "ayomi-staff-daycare";

function savedId() {
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function DaycareProvider({ children }) {
  const { data, error, loading, reload } = useApi("/api/me/daycares");
  const [chosen, setChosen] = useState(null);
  const daycares = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const daycare = daycares.find(item => item.id === (chosen ?? savedId())) ?? daycares[0] ?? null;
  const value = useMemo(() => ({
    daycares, daycare, reload,
    isManager: daycare?.member_role === "manager",
    select(id) { setChosen(id); try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* optional */ } },
  }), [daycares, daycare, reload]);

  if (loading) return <Loading label="Memuat daycare Anda…" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!daycare) {
    return <Empty title="Akun Anda belum terhubung ke daycare">
      Pengelola terhubung lewat undangan Admin. Pengasuh terhubung lewat undangan Pengelola, lalu menunggu verifikasi.
    </Empty>;
  }
  return <DaycareContext.Provider value={value}>{children}</DaycareContext.Provider>;
}

export function useDaycare() {
  const context = useContext(DaycareContext);
  if (!context) throw new Error("DaycareProvider diperlukan.");
  return context;
}
