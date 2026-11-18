"use client";

import { Building2, FileCheck2, LayoutDashboard, ShieldAlert } from "lucide-react";
import { StaffNavbar, StaffSidebar } from "./StaffNavigation";

const MENU = [
  ["Overview platform", "/admin", LayoutDashboard],
  ["Verifikasi legalitas", "/admin/verifikasi-legal", FileCheck2],
  ["Insiden & komplain", "/admin/insiden", ShieldAlert],
  ["Manajemen daycare", "/admin/daycare", Building2],
];

export function AdminNavbar() {
  return <StaffNavbar home="/admin" badge="Administrator" menu={MENU} />;
}

export default function AdminSidebar() {
  return <StaffSidebar label="Pusat kendali Ayomi" root="/admin" title="Kepercayaan dimulai dari pengawasan." subtitle="Verifikasi, moderasi, dan keselamatan" menu={MENU} />;
}
