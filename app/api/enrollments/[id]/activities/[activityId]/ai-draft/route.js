import { apiRoute } from "@/lib/api/http";
import { authenticate } from "@/lib/api/server";
import { draftActivity } from "@/lib/api/logbook-draft";

// Assigned caregiver: AI draft of their own saved draft activity (Logbook
// Drafter). Returns a proposal only; the caregiver reviews and saves it.
// Model calls may take up to 60 s per attempt.
export const maxDuration = 60;
export const POST = apiRoute(authenticate, async (context, _request, route) => {
  const { id, activityId } = await route.params;
  return draftActivity(context, id, activityId);
});
