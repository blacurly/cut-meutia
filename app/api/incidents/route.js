import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { createIncident, listIncidents } from "@/lib/api/incidents";

export const GET = apiRoute(authenticate, (context, request) => listIncidents(context, new URL(request.url).searchParams));
export const POST = apiRoute(authenticate, createIncident, 201);
