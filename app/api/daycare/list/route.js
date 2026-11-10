import { apiRoute } from "@/lib/api/http";
import { authenticateOptional } from "@/lib/api/server";
import { listDirectory } from "@/lib/api/directory";

// Public: the catalog can be browsed before login (docs/alur-bisnis 3.1).
// Kept for existing clients; /api/daycares is the same endpoint.
export const GET = apiRoute(authenticateOptional, (context, request) =>
  listDirectory(context, { mediaBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, searchParams: new URL(request.url).searchParams }));
