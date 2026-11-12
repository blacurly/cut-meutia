import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { createPickupAuthorization, listPickupAuthorizations } from "@/lib/api/casework";

export const runtime = "nodejs";
export const GET = apiRoute(authenticate, listPickupAuthorizations);
export const POST = apiRoute(authenticate, createPickupAuthorization, 201);
