import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { submitReview } from "@/lib/api/reviews";

export const POST = apiRoute(authenticate, submitReview, 201);
