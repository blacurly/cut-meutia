import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { acknowledgeActivity } from "@/lib/api/activities";

export const POST = apiRoute(authenticate, async (context, request, route) => acknowledgeActivity(context, request, (await route.params).id), 201);
