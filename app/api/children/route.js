import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { createChild } from "@/lib/api/parent";

export const POST = apiRoute(authenticate, createChild, 201);
