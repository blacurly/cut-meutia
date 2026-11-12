import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listAdminDocuments } from "@/lib/api/partner-onboarding";

export const runtime = "nodejs";
export const GET = apiRoute(authenticate, listAdminDocuments);
