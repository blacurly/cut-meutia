import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listNotifications } from "@/lib/api/account";

export const GET = apiRoute(authenticate, (context, request) => listNotifications(context, new URL(request.url).searchParams));
