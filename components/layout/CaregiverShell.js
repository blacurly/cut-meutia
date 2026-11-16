"use client";

import UniversalNavbar from "./UniversalNavbar";
import CaregiverSidebar from "./CaregiverNavigation";
import { DaycareProvider } from "@/components/live/DaycareContext";
import { RequireRole } from "@/components/live/ui";
import c from "@/components/features/Caregiver.module.css";

// Portal for Pengelola and Pengasuh: signed-in staff of an active daycare
// membership only. Data comes from the API (see components/live/*).
export default function CaregiverShell({ children }) {
  return <div className={c.shell}>
    <a className={c.skip} href="#konten-pengelola">Langsung ke konten</a>
    <UniversalNavbar role="caregiver" />
    <RequireRole roles={["manager", "caregiver"]}>
      <DaycareProvider>
        <CaregiverSidebar />
        <div className={c.workspace}><main id="konten-pengelola" tabIndex={-1} className={c.page}>{children}</main></div>
      </DaycareProvider>
    </RequireRole>
  </div>;
}
