import { apiRoute } from "@/lib/api/http";
import { sessionClient } from "@/lib/api/server";
import { logout } from "@/lib/api/auth";

export const POST = apiRoute(sessionClient, logout, 200);
