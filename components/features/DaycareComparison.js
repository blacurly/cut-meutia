"use client";
import { useParentDemo } from "./ParentDemoProvider";
import CatalogComparison from "./CatalogComparison";
import { isUuid } from "@/lib/daycare-directory";

// Daycares chosen with the Bandingkan button are compared through
// GET /api/daycares/compare. The selection itself is kept in the browser.
export default function DaycareComparison({ results = false }) {
  const { state } = useParentDemo();
  return <CatalogComparison ids={state.compare.filter(isUuid)} results={results} />;
}
