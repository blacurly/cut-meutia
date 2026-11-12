import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listComplaintEvidence, uploadComplaintEvidence } from "@/lib/api/casework";

export const runtime = "nodejs";
export const GET = apiRoute(authenticate, listComplaintEvidence);
export const POST = apiRoute(authenticate, uploadComplaintEvidence, 201);
