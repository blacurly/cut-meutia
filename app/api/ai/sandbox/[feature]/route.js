import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { runSandbox } from "@/lib/api/ai";

// Admin: run one AI task on a contract input (synthetic data) and get the
// job envelope back. Model calls may take up to 60 s per attempt.
export const maxDuration = 60;
export const POST = apiRoute(authenticate, async (context, request, route) => runSandbox(context, request, (await route.params).feature));
