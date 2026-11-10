import { apiRoute } from "@/lib/api/http";
import { authenticateOptional } from "@/lib/api/server";
import { listDirectory } from "@/lib/api/directory";

// Public catalog with server-side filters (see docs/api.md).
export const GET = apiRoute(authenticateOptional, (context, request) =>
  listDirectory(context, { mediaBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, searchParams: new URL(request.url).searchParams }));
