import { apiRoute } from "@/lib/api/http";
import { authenticateOptional } from "@/lib/api/server";
import { listDirectory } from "@/lib/api/directory";

// Public: the catalog can be browsed before login (docs/alur-bisnis 3.1).
export const GET = apiRoute(authenticateOptional, context =>
  listDirectory(context, { mediaBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL }));
