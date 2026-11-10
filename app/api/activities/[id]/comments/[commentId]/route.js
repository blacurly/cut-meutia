import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { deleteActivityComment } from "@/lib/api/activities";

export const DELETE = apiRoute(authenticate, async (context, request, route) => {
  const { id, commentId } = await route.params;
  return deleteActivityComment(context, id, commentId);
});
