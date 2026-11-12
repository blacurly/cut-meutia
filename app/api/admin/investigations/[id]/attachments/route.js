import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listInvestigationEvidence, uploadInvestigationEvidence } from "@/lib/api/casework";

export const runtime = "nodejs";
export const GET = apiRoute(authenticate, listInvestigationEvidence);
export const POST = apiRoute(authenticate, uploadInvestigationEvidence, 201);
