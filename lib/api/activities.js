// Daily activity log (catatan harian), written by the assigned caregiver.
// The caregiver may ask for an AI draft of a saved draft activity
// (lib/api/logbook-draft.js); the text is only saved after they review it.
import { readObject } from "./http.js";
import { boolean, invalid, isoDate, oneOf, requestId, rpc, text, timestamp, uuid } from "./validate.js";

const TYPES = ["play", "learning", "interaction", "meal", "sleep", "other"];
const FIELDS = ["report_date", "activity_type", "title", "body", "occurred_at", "status", "is_urgent", "urgent_reason", "change_reason", "details"];

// Optional structured facts for meal and sleep activities, stored in
// daily_report_activities.details and used as input for the AI draft.
export function activityDetails(value, activityType) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) invalid("details", "Detail kegiatan tidak valid.");
  if (activityType === "meal" && value.meal != null) {
    const meal = value.meal;
    if (typeof meal !== "object" || Array.isArray(meal)) invalid("details", "Detail makan tidak valid.");
    return { meal: {
      food: text(meal.food, "meal_food", { min: 2, max: 200, label: "Menu makanan" }),
      portion_consumed: text(meal.portion_consumed, "meal_portion", { min: 1, max: 100, label: "Porsi yang dimakan" }),
      observed_condition: text(meal.observed_condition, "meal_condition", { min: 2, max: 300, label: "Kondisi saat makan" }),
    } };
  }
  if (activityType === "sleep" && value.sleep != null) {
    const sleep = value.sleep;
    if (typeof sleep !== "object" || Array.isArray(sleep)) invalid("details", "Detail tidur tidak valid.");
    const startedAt = timestamp(sleep.started_at, "sleep_started_at", "Jam mulai tidur");
    const endedAt = sleep.ended_at == null || sleep.ended_at === "" ? null : timestamp(sleep.ended_at, "sleep_ended_at", "Jam bangun");
    if (endedAt && Date.parse(endedAt) < Date.parse(startedAt)) invalid("sleep_ended_at", "Jam bangun harus setelah jam mulai tidur.");
    return { sleep: {
      started_at: startedAt, ended_at: endedAt,
      condition_after: text(sleep.condition_after, "sleep_condition", { max: 300, label: "Kondisi setelah tidur", optional: true }),
    } };
  }
  return {};
}

export async function listActivities(context, enrollmentId) {
  return rpc(context, "app_list_daily_activities", { p_enrollment_id: uuid(enrollmentId, "enrollment_id", "ID pengajuan") });
}

export async function saveActivity(context, request, enrollmentId, activityId = null) {
  uuid(enrollmentId, "enrollment_id", "ID pengajuan");
  if (activityId) uuid(activityId, "activity_id", "ID catatan");
  const body = await readObject(request, FIELDS);
  const isUrgent = body.is_urgent == null ? false : boolean(body.is_urgent, "is_urgent", "Penanda penting");
  const urgentReason = text(body.urgent_reason, "urgent_reason", { min: isUrgent ? 5 : 0, max: 500, label: "Alasan catatan penting", optional: !isUrgent });
  const changeReason = activityId
    ? text(body.change_reason, "change_reason", { min: 5, max: 500, label: "Alasan perubahan" })
    : null;
  const occurredAt = timestamp(body.occurred_at, "occurred_at", "Waktu kegiatan");
  if (Date.parse(occurredAt) > Date.now() + 5 * 60 * 1000) invalid("occurred_at", "Waktu kegiatan tidak boleh di masa depan.");
  const activityType = oneOf(body.activity_type, "activity_type", TYPES, "Jenis kegiatan");
  // An update without "details" (e.g. "Kirim ke Orang Tua") keeps the stored ones.
  const details = activityId && body.details === undefined
    ? await storedDetails(context, activityId, activityType)
    : activityDetails(body.details, activityType);
  const id = await rpc(context, "app_save_daily_activity", {
    p_activity_id: activityId,
    p_enrollment_id: enrollmentId,
    p_report_date: isoDate(body.report_date, "report_date", "Tanggal catatan"),
    p_activity_type: activityType,
    p_title: text(body.title, "title", { min: 3, max: 100, label: "Judul" }),
    p_body: text(body.body, "body", { min: 20, max: 2000, label: "Isi catatan" }),
    p_occurred_at: occurredAt,
    p_details: details,
    p_status: oneOf(body.status, "status", ["draft", "sent"], "Status"),
    p_is_urgent: isUrgent,
    p_urgent_reason: urgentReason,
    p_change_reason: changeReason,
    p_request_id: requestId(request),
  });
  return { id };
}

async function storedDetails({ supabase }, activityId, activityType) {
  const { data } = await supabase.from("daily_report_activities").select("details").eq("id", activityId).maybeSingle();
  const key = { meal: "meal", sleep: "sleep" }[activityType];
  return key && data?.details?.[key] ? { [key]: data.details[key] } : {};
}

export async function deleteDraftActivity(context, activityId) {
  await rpc(context, "app_delete_draft_activity", { p_activity_id: uuid(activityId, "activity_id", "ID catatan") });
  return { id: activityId, deleted: true };
}

// Love reaction (parent only). PUT sets it, DELETE removes it; both idempotent.
export async function setActivityLove(context, activityId, active) {
  return rpc(context, "app_set_activity_reaction", {
    p_activity_id: uuid(activityId, "activity_id", "ID catatan"),
    p_active: active,
  });
}

export async function listActivityComments(context, activityId) {
  return rpc(context, "app_list_activity_comments", { p_activity_id: uuid(activityId, "activity_id", "ID catatan") });
}

export async function addActivityComment(context, request, activityId) {
  uuid(activityId, "activity_id", "ID catatan");
  const body = await readObject(request, ["body"]);
  return rpc(context, "app_add_activity_comment", {
    p_activity_id: activityId,
    p_body: text(body.body, "body", { min: 1, max: 1000, label: "Komentar" }),
    p_request_id: requestId(request),
  });
}

export async function deleteActivityComment(context, activityId, commentId) {
  uuid(activityId, "activity_id", "ID catatan");
  await rpc(context, "app_delete_activity_comment", { p_comment_id: uuid(commentId, "comment_id", "ID komentar") });
  return { id: commentId, deleted: true };
}

export async function acknowledgeActivity(context, request, activityId) {
  uuid(activityId, "activity_id", "ID catatan");
  const body = await readObject(request, ["type"]);
  await rpc(context, "app_acknowledge_activity", {
    p_activity_id: activityId,
    p_ack_type: oneOf(body.type, "type", ["parent_read", "manager_review"], "Jenis konfirmasi"),
  });
  return { id: activityId, acknowledged: body.type };
}
