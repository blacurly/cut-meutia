import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { segmentPhoto } from "@/lib/api/focus";

// Staff: find the people in a photo (Foto Fokus Anak). The CV service may
// need to wake up, so allow up to 60 s.
export const maxDuration = 60;
export const POST = apiRoute(authenticate, (context, request) => segmentPhoto(context, request));
