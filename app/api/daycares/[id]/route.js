import { apiRoute } from "@/lib/api/http";
import { authenticateOptional } from "@/lib/api/server";
import { getDaycareDetail } from "@/lib/api/directory";

// Public daycare detail by UUID or slug.
export const GET = apiRoute(authenticateOptional, async (context, request, route) =>
  getDaycareDetail(context, (await route.params).id, { mediaBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL }));
