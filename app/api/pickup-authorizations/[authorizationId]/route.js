import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { revokePickupAuthorization } from "@/lib/api/casework";

export const runtime = "nodejs";
export const DELETE = apiRoute(authenticate, revokePickupAuthorization);
