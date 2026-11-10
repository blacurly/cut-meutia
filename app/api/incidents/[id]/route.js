import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { updateIncidentStatus } from "@/lib/api/incidents";

export const PATCH = apiRoute(authenticate, async (context, request, route) => updateIncidentStatus(context, request, (await route.params).id));
