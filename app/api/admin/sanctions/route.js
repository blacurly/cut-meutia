import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { createAdminSanction, listAdminSanctions } from "@/lib/api/casework";

export const runtime = "nodejs";
export const GET = apiRoute(authenticate, listAdminSanctions);
export const POST = apiRoute(authenticate, createAdminSanction, 201);
