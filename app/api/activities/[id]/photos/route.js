import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { listActivityPhotos, uploadActivityPhoto } from "@/lib/api/logbook-media";

export const maxDuration = 60;
export const GET = apiRoute(authenticate, listActivityPhotos);
export const POST = apiRoute(authenticate, uploadActivityPhoto, 201);

