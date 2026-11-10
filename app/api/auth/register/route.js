import { apiRoute } from "@/lib/api/http";
import { sessionClient } from "@/lib/api/server";
import { register } from "@/lib/api/auth";

export const POST = apiRoute(sessionClient, register, 201);
