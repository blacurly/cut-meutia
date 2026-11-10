import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { addActivityComment, listActivityComments } from "@/lib/api/activities";

export const GET = apiRoute(authenticate, async (context, request, route) => listActivityComments(context, (await route.params).id));
export const POST = apiRoute(authenticate, async (context, request, route) => addActivityComment(context, request, (await route.params).id), 201);
