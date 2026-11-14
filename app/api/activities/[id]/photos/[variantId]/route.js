import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { reviewActivityPhoto } from "@/lib/api/logbook-media";

export const PATCH = apiRoute(authenticate, reviewActivityPhoto);

