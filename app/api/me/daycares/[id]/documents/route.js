import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listDocuments, submitDocument } from "@/lib/api/partner-onboarding";

export const runtime = "nodejs";
export const GET = apiRoute(authenticate, listDocuments);
export const POST = apiRoute(authenticate, submitDocument, 201);
