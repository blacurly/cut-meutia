import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listMyDaycares } from "@/lib/api/account";

export const GET = apiRoute(authenticate, listMyDaycares);
