import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { deleteDraftActivity, saveActivity } from "@/lib/api/activities";

export const PATCH = apiRoute(authenticate, async (context, request, route) => {
  const { id, activityId } = await route.params;
  return saveActivity(context, request, id, activityId);
});
export const DELETE = apiRoute(authenticate, async (context, _request, route) => deleteDraftActivity(context, (await route.params).activityId));
