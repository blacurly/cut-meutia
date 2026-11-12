import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { decidePartnerStatus } from "@/lib/api/partner-onboarding";

export const runtime = "nodejs";
export const PATCH = apiRoute(authenticate, decidePartnerStatus);
