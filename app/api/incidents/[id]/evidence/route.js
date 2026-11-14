import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listIncidentEvidence, uploadIncidentEvidence } from "@/lib/api/incident-evidence";

export const GET = apiRoute(authenticate, listIncidentEvidence);
export const POST = apiRoute(authenticate, uploadIncidentEvidence, 201);

