import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listAdminComplaints } from "@/lib/api/casework";

export const runtime = "nodejs";
export const GET = apiRoute(authenticate, listAdminComplaints);
