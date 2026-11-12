import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { createDelegation, listDelegations } from "@/lib/api/casework";

export const runtime = "nodejs";
export const GET = apiRoute(authenticate, listDelegations);
export const POST = apiRoute(authenticate, createDelegation, 201);
