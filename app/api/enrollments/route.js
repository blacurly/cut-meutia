import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { createEnrollment, listEnrollments } from "@/lib/api/enrollments";

export const GET = apiRoute(authenticate, (context, request) => listEnrollments(context, new URL(request.url).searchParams));
export const POST = apiRoute(authenticate, createEnrollment, 201);
