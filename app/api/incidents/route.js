import { after } from "next/server";
import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { createIncident, listIncidents } from "@/lib/api/incidents";
import { triageNewIncident } from "@/lib/api/incident-triage";

// The triage below runs after the response; its retries can take ~1 minute.
export const maxDuration = 120;

export const GET = apiRoute(authenticate, (context, request) => listIncidents(context, new URL(request.url).searchParams));

// The report is saved and the first notifications are sent before AI runs, so
// the reporter never waits for it (contract: "notifikasi awal tidak menunggu AI").
export const POST = apiRoute(authenticate, async (context, request) => {
  const created = await createIncident(context, request);
  after(() => triageNewIncident(context, created.id));
  return created;
}, 201);
