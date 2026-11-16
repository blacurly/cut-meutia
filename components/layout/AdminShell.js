"use client";

import UniversalNavbar from "./UniversalNavbar";
import AdminSidebar from "./AdminNavigation";
import { RequireRole } from "@/components/live/ui";
import c from "@/components/features/Caregiver.module.css";

// Admin portal: signed-in accounts with role "admin" only.
export default function AdminShell({ children }) {
  return <div className={c.shell}>
    <a className={c.skip} href="#konten-admin">Langsung ke konten</a>
    <UniversalNavbar role="admin" />
    <RequireRole roles={["admin"]}>
      <AdminSidebar />
      <div className={c.workspace}><main className={c.page} id="konten-admin" tabIndex={-1}>{children}</main></div>
    </RequireRole>
  </div>;
}
