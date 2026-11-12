import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { acceptInvitation } from "@/lib/api/invitations";

export const runtime = "nodejs";
export const POST = apiRoute(authenticate, acceptInvitation, 200);
