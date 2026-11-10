import { apiRoute } from "@/lib/api/http";
import { authenticateOptional } from "@/lib/api/server";
import { listPublicReviews } from "@/lib/api/reviews";

// Public: moderated reviews only; the author is never exposed.
export const GET = apiRoute(authenticateOptional, async (context, _request, route) => listPublicReviews(context, (await route.params).id));
