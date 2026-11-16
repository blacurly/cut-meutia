import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listAdminPayments } from "@/lib/api/account";

// Admin: payments waiting for manual confirmation (?status= to filter).
export const GET = apiRoute(authenticate, (context, request) => listAdminPayments(context, new URL(request.url).searchParams));
