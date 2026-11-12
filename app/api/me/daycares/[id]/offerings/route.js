import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listOfferings, saveOffering } from "@/lib/api/partner-onboarding";

export const runtime = "nodejs";
export const GET = apiRoute(authenticate, listOfferings);
export const POST = apiRoute(authenticate, saveOffering, 201);
export const PATCH = apiRoute(authenticate, saveOffering);
