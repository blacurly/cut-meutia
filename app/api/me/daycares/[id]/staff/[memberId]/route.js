import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { endCaregiver } from "@/lib/api/partner-onboarding";

export const runtime = "nodejs";
export const DELETE = apiRoute(authenticate, endCaregiver);
