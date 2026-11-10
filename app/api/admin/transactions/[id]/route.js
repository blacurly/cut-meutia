import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { recordPaymentResult } from "@/lib/api/account";

export const PATCH = apiRoute(authenticate, async (context, request, route) => recordPaymentResult(context, request, (await route.params).id));
