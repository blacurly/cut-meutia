import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { createPartner, listPartners } from "@/lib/api/partners";

export const runtime = "nodejs";
export const GET = apiRoute(authenticate, listPartners);
export const POST = apiRoute(authenticate, createPartner, 201);
