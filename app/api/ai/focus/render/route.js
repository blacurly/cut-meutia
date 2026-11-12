import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { renderPhoto } from "@/lib/api/focus";

// Staff: make the focus photo for one target child (others and background
// blurred). Returns the JPEG as base64; nothing is stored.
export const maxDuration = 60;
export const POST = apiRoute(authenticate, (context, request) => renderPhoto(context, request));
