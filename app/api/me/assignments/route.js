import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listMyAssignments } from "@/lib/api/account";

// Pengasuh: enrollments currently assigned to the signed-in caregiver.
export const GET = apiRoute(authenticate, context => listMyAssignments(context));
