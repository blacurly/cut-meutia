import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { archiveChild, getChild, updateChild } from "@/lib/api/children";

export const GET = apiRoute(authenticate, async (context, _request, route) => getChild(context, (await route.params).id));
export const PATCH = apiRoute(authenticate, async (context, request, route) => updateChild(context, request, (await route.params).id));
export const DELETE = apiRoute(authenticate, async (context, _request, route) => archiveChild(context, (await route.params).id));
