import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { createChild } from "@/lib/api/parent";
import { listChildren } from "@/lib/api/children";

export const GET = apiRoute(authenticate, listChildren);
export const POST = apiRoute(authenticate, createChild, 201);
