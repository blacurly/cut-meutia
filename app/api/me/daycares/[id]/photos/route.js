import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listManagerPhotos, submitDaycarePhoto } from "@/lib/api/partner-onboarding";

export const runtime = "nodejs";
export const GET = apiRoute(authenticate, listManagerPhotos);
export const POST = apiRoute(authenticate, submitDaycarePhoto, 201);
