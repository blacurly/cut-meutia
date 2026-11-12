import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { decideDocument } from "@/lib/api/partner-onboarding";

export const runtime = "nodejs";
export const PATCH = apiRoute(authenticate, decideDocument);
