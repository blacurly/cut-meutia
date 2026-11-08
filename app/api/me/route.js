import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { getMe, updateMe } from "@/lib/api/parent";

export const GET = apiRoute(authenticate, getMe);
export const PATCH = apiRoute(authenticate, updateMe);
