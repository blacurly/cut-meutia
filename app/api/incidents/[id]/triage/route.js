import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { retriageIncident } from "@/lib/api/incident-triage";

export const runtime = "nodejs";
export const maxDuration = 120;

// Manager/Admin: run the AI triage again (the first run failed or was skipped).
export const POST = apiRoute(authenticate, async (context, _request, route) => retriageIncident(context, (await route.params).id));
