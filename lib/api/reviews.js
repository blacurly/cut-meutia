// Reviews with manual moderation (non-AI), public partner-daycare data, and
// the Admin moderation queue.
import { readObject, readOptionalObject } from "./http.js";
import { databaseData } from "./errors.js";
import { integer, oneOf, requestId, rpc, text, uuid } from "./validate.js";
import { isDaycareKey, isUuid } from "../daycare-directory.js";

export const listPublicReviews = (context, daycareId) =>
  rpc(context, "app_list_public_reviews", { p_daycare_id: uuid(daycareId, "daycare_id", "ID daycare") });

// Accepts a partner daycare id, or a catalog listing id/slug that is linked
// to an active partner daycare (the catalog's "daftar online" button).
export async function listOfferings(context, key) {
  if (!isDaycareKey(key)) uuid(key, "daycare_id", "ID daycare");
  const listing = databaseData(await context.supabase.from("daycare_listings").select("claimed_daycare_id")
    .eq(isUuid(key) ? "id" : "slug", key).eq("visibility", "published").maybeSingle());
  const daycareId = listing?.claimed_daycare_id ?? (isUuid(key) ? key : null);
  if (!daycareId) return [];
  return rpc(context, "app_list_daycare_offerings", { p_daycare_id: daycareId });
}

export async function submitReview(context, request) {
  const body = await readObject(request, ["enrollment_id", "rating", "body"]);
  const id = await rpc(context, "app_submit_review", {
    p_enrollment_id: uuid(body.enrollment_id, "enrollment_id", "ID pengajuan"),
    p_rating: integer(body.rating, "rating", { min: 1, max: 5, label: "Rating" }),
    p_body: text(body.body, "body", { min: 20, max: 2000, label: "Ulasan" }),
    p_request_id: requestId(request),
  });
  return { id, moderation_status: "pending" };
}

export async function withdrawReview(context, request, id) {
  uuid(id, "review_id", "ID ulasan");
  const body = await readOptionalObject(request, ["reason"]);
  await rpc(context, "app_parent_withdraw_review", {
    p_review_id: id,
    p_reason: text(body.reason, "reason", { min: 5, max: 500, label: "Alasan penarikan" }),
    p_request_id: requestId(request),
  });
  return { id, withdrawn: true };
}

export async function replyToReview(context, request, id) {
  uuid(id, "review_id", "ID ulasan");
  const body = await readObject(request, ["body"]);
  const versionId = await rpc(context, "app_manager_submit_review_reply", {
    p_review_id: id,
    p_body: text(body.body, "body", { min: 10, max: 2000, label: "Balasan" }),
    p_request_id: requestId(request),
  });
  return { version_id: versionId, moderation_status: "pending" };
}

export const moderationQueue = context => rpc(context, "app_admin_list_moderation_queue");

export async function moderate(context, request, kind, versionId) {
  const target = oneOf(kind, "kind", ["reviews", "replies"], "Jenis konten");
  uuid(versionId, "version_id", "ID versi");
  const body = await readObject(request, ["decision", "reason"]);
  await rpc(context, target === "reviews" ? "app_admin_moderate_review" : "app_admin_moderate_review_reply", {
    p_version_id: versionId,
    p_decision: oneOf(body.decision, "decision", ["approved", "rejected"], "Keputusan"),
    p_reason: text(body.reason, "reason", { min: 5, max: 500, label: "Alasan moderasi" }),
    p_request_id: requestId(request),
  });
  return { version_id: versionId, decision: body.decision };
}
