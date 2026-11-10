import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { createPayment } from "@/lib/api/enrollments";

export const POST = apiRoute(authenticate, async (context, request, route) => createPayment(context, request, (await route.params).id), 201);
