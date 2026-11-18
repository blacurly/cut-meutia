"use client";

import { BookOpen, Building2, ClipboardList, FileCheck2, Images, LayoutDashboard, MessageSquare, ScanFace, ShieldAlert, Users } from "lucide-react";
import { useDaycare } from "@/components/live/DaycareContext";
import { useSession } from "@/components/session/SessionProvider";
import { StaffNavbar, StaffSidebar } from "./StaffNavigation";

const MANAGER_MENU = [
  ["Dashboard", "/pengelola", LayoutDashboard],
  ["Kelola pendaftaran", "/pengelola/pendaftaran", ClipboardList],
  ["Logbook harian", "/pengelola/laporan-harian", BookOpen],
  ["Laporan insiden", "/pengelola/insiden", ShieldAlert],
  ["Ulasan & balasan", "/pengelola/ulasan", MessageSquare],
  ["Staf & undangan", "/pengelola/staf", Users],
  ["Dokumen legalitas", "/pengelola/dokumen", FileCheck2],
  ["Profil bisnis", "/pengelola/profil", Building2],
  ["Foto daycare", "/pengelola/foto", Images],
  ["Uji Foto Fokus (AI)", "/pengelola/foto-fokus", ScanFace],
];
const CAREGIVER_MENU = [
  ["Dashboard", "/pengelola", LayoutDashboard],
  ["Logbook harian", "/pengelola/laporan-harian", BookOpen],
  ["Laporan insiden", "/pengelola/insiden", ShieldAlert],
  ["Uji Foto Fokus (AI)", "/pengelola/foto-fokus", ScanFace],
];

// The navbar sits outside DaycareProvider, so the mobile menu follows the
// account role (users.role); the sidebar follows the daycare membership.
export function CaregiverNavbar() {
  const session = useSession();
  return <StaffNavbar home="/pengelola" badge="Portal daycare" menu={session.role === "manager" ? MANAGER_MENU : session.role === "caregiver" ? CAREGIVER_MENU : []} />;
}

// Rendered inside DaycareProvider (components/layout/CaregiverShell.js).
export default function CaregiverSidebar() {
  const { daycare, isManager } = useDaycare();
  return <StaffSidebar label="Ruang daycare" root="/pengelola" title={daycare.name}
    subtitle={`${isManager ? "Pengelola" : "Pengasuh"} · status daycare: ${daycare.status}`}
    menu={isManager ? MANAGER_MENU : CAREGIVER_MENU} />;
}
