import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { updateAdminComplaint } from "@/lib/api/casework";

export const runtime = "nodejs";
export const PATCH = apiRoute(authenticate, updateAdminComplaint);
