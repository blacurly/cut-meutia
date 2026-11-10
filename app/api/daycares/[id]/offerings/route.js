import { apiRoute } from "@/lib/api/http";
import { authenticateOptional } from "@/lib/api/server";
import { listOfferings } from "@/lib/api/reviews";

// Public: services and approved prices of a partner daycare.
export const GET = apiRoute(authenticateOptional, async (context, _request, route) => listOfferings(context, (await route.params).id));
