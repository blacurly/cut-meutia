import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { inviteCaregiver } from "@/lib/api/partner-onboarding";

export const runtime = "nodejs";
export const POST = apiRoute(authenticate, inviteCaregiver, 201);
