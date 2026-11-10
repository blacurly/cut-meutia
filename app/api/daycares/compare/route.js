import { apiRoute } from "@/lib/api/http";
import { authenticateOptional } from "@/lib/api/server";
import { compareDaycares } from "@/lib/api/directory";

// Public side-by-side comparison: /api/daycares/compare?ids=a,b,c
export const GET = apiRoute(authenticateOptional, (context, request) =>
  compareDaycares(context, new URL(request.url).searchParams, { mediaBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL }));
