import { apiRoute } from "@/lib/api/http";
import { listFeatures } from "@/lib/api/ai";

// Public: AI job types, use case, processor, roles, and example input.
export const GET = apiRoute(async () => ({}), listFeatures);
