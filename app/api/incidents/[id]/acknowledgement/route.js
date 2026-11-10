import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { acknowledgeIncident } from "@/lib/api/incidents";

export const POST = apiRoute(authenticate, async (context, _request, route) => acknowledgeIncident(context, (await route.params).id), 201);
