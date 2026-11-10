import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listActivities, saveActivity } from "@/lib/api/activities";

export const GET = apiRoute(authenticate, async (context, _request, route) => listActivities(context, (await route.params).id));
export const POST = apiRoute(authenticate, async (context, request, route) => saveActivity(context, request, (await route.params).id), 201);
