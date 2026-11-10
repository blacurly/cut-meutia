import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { moderate } from "@/lib/api/reviews";

export const PATCH = apiRoute(authenticate, async (context, request, route) => {
  const { kind, versionId } = await route.params;
  return moderate(context, request, kind, versionId);
});
