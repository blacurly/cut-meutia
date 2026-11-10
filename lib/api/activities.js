// Daily activity log (catatan harian), written manually by the assigned
// caregiver. AI drafting is out of scope; draft_ai_job_id stays NULL.
import { readObject } from "./http.js";
import { boolean, invalid, isoDate, oneOf, requestId, rpc, text, timestamp, uuid } from "./validate.js";

const TYPES = ["play", "learning", "interaction", "meal", "sleep", "other"];
const FIELDS = ["report_date", "activity_type", "title", "body", "occurred_at", "status", "is_urgent", "urgent_reason", "change_reason"];

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
  const id = await rpc(context, "app_save_daily_activity", {
    p_activity_id: activityId,
    p_enrollment_id: enrollmentId,
    p_report_date: isoDate(body.report_date, "report_date", "Tanggal catatan"),
    p_activity_type: oneOf(body.activity_type, "activity_type", TYPES, "Jenis kegiatan"),
    p_title: text(body.title, "title", { min: 3, max: 100, label: "Judul" }),
    p_body: text(body.body, "body", { min: 20, max: 2000, label: "Isi catatan" }),
    p_occurred_at: occurredAt,
    p_details: {},
    p_status: oneOf(body.status, "status", ["draft", "sent"], "Status"),
    p_is_urgent: isUrgent,
    p_urgent_reason: urgentReason,
    p_change_reason: changeReason,
    p_request_id: requestId(request),
  });
  return { id };
}

export async function deleteDraftActivity(context, activityId) {
  await rpc(context, "app_delete_draft_activity", { p_activity_id: uuid(activityId, "activity_id", "ID catatan") });
  return { id: activityId, deleted: true };
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
