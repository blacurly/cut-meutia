import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listEnrollmentPickups, recordEnrollmentPickup } from "@/lib/api/casework";

export const runtime = "nodejs";
export const GET = apiRoute(authenticate, listEnrollmentPickups);
export const POST = apiRoute(authenticate, recordEnrollmentPickup, 201);
