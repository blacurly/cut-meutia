import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { moderationQueue } from "@/lib/api/reviews";

export const GET = apiRoute(authenticate, moderationQueue);
