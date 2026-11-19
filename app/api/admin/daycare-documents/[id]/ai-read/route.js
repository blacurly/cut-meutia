import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { getDocumentAiRead, readDocumentWithAi } from "@/lib/api/legal-read";

// Admin only (the database functions reject other roles). OCR of a long scan
// plus the language model can take a minute or two.
export const runtime = "nodejs";
export const maxDuration = 300;
export const GET = apiRoute(authenticate, getDocumentAiRead);
export const POST = apiRoute(authenticate, (context, request, route) => readDocumentWithAi(context, request, route));
