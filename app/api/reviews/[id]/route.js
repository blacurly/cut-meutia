import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { withdrawReview } from "@/lib/api/reviews";

export const DELETE = apiRoute(authenticate, async (context, request, route) => withdrawReview(context, request, (await route.params).id));
