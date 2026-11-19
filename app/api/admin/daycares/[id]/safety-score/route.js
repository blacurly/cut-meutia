import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { getSafetyReview, saveSafetyScore, withdrawSafetyScore } from "@/lib/api/safety-score";

// Admin only; the database functions reject every other role.
export const runtime = "nodejs";
export const GET = apiRoute(authenticate, getSafetyReview);
export const POST = apiRoute(authenticate, saveSafetyScore);
export const DELETE = apiRoute(authenticate, withdrawSafetyScore);
