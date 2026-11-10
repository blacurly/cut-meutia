import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { cancelEnrollment, getEnrollment, updateEnrollment } from "@/lib/api/enrollments";

export const GET = apiRoute(authenticate, async (context, _request, route) => getEnrollment(context, (await route.params).id));
export const PATCH = apiRoute(authenticate, async (context, request, route) => updateEnrollment(context, request, (await route.params).id));
export const DELETE = apiRoute(authenticate, async (context, request, route) => cancelEnrollment(context, request, (await route.params).id));
