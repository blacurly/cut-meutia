import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { overrideIncidentUrgency } from "@/lib/api/incident-triage";

// Manager/Admin set the effective urgency themselves, with a reason.
export const POST = apiRoute(authenticate, async (context, request, route) => overrideIncidentUrgency(context, request, (await route.params).id));
