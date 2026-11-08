import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { getChildHealth, updateChildHealth } from "@/lib/api/parent";

export const GET = apiRoute(authenticate, async (context, _request, route) => {
  const { id } = await route.params;
  return getChildHealth(context, id);
});

export const PATCH = apiRoute(authenticate, async (context, request, route) => {
  const { id } = await route.params;
  return updateChildHealth(context, request, id);
});
