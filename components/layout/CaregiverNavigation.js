"use client";

import { BookOpen, Building2, ClipboardList, FileCheck2, LayoutDashboard, MessageSquare, ScanFace, ShieldAlert, Users } from "lucide-react";
import { useDaycare } from "@/components/live/DaycareContext";
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
  ["Uji Foto Fokus (AI)", "/pengelola/foto-fokus", ScanFace],
];
const CAREGIVER_MENU = [
  ["Dashboard", "/pengelola", LayoutDashboard],
  ["Logbook harian", "/pengelola/laporan-harian", BookOpen],
  ["Laporan insiden", "/pengelola/insiden", ShieldAlert],
  ["Uji Foto Fokus (AI)", "/pengelola/foto-fokus", ScanFace],
];

export function CaregiverNavbar() {
  return <StaffNavbar home="/pengelola" badge="Portal daycare" />;
}

// Rendered inside DaycareProvider (components/layout/CaregiverShell.js).
export default function CaregiverSidebar() {
  const { daycare, isManager } = useDaycare();
  return <StaffSidebar label="Ruang daycare" root="/pengelola" title={daycare.name}
    subtitle={`${isManager ? "Pengelola" : "Pengasuh"} · status daycare: ${daycare.status}`}
    menu={isManager ? MANAGER_MENU : CAREGIVER_MENU} />;
}
