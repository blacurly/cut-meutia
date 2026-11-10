import { apiRoute } from "@/lib/api/http";
import { sessionClient } from "@/lib/api/server";
import { login } from "@/lib/api/auth";

export const POST = apiRoute(sessionClient, login, 200);
