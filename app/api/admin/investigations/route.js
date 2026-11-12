import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { createInvestigation, listInvestigations } from "@/lib/api/casework";

export const runtime = "nodejs";
export const GET = apiRoute(authenticate, listInvestigations);
export const POST = apiRoute(authenticate, createInvestigation, 201);
