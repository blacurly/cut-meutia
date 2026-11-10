import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { markNotification } from "@/lib/api/account";

export const PATCH = apiRoute(authenticate, async (context, request, route) => markNotification(context, request, (await route.params).id));
