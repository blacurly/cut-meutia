import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { replyToReview } from "@/lib/api/reviews";

export const POST = apiRoute(authenticate, async (context, request, route) => replyToReview(context, request, (await route.params).id), 201);
