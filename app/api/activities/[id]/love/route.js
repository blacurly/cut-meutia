import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { setActivityLove } from "@/lib/api/activities";

// Favorit logbook: the parent marks (PUT) or unmarks (DELETE) an activity.
export const PUT = apiRoute(authenticate, async (context, request, route) => setActivityLove(context, (await route.params).id, true));
export const DELETE = apiRoute(authenticate, async (context, request, route) => setActivityLove(context, (await route.params).id, false));
