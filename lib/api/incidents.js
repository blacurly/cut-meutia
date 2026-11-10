// Incident reports with manual urgency (non-AI). The reporter chooses the
// urgency; AI triage is a separate, later feature.
import { readObject } from "./http.js";
import { invalid, oneOf, requestId, rpc, text, timestamp, uuid } from "./validate.js";

export async function listIncidents(context, searchParams) {
  const enrollmentId = searchParams.get("enrollment_id");
  return rpc(context, "app_list_incidents", {
    p_enrollment_id: enrollmentId ? uuid(enrollmentId, "enrollment_id", "ID pengajuan") : null,
  });
}

export async function createIncident(context, request) {
  const body = await readObject(request, ["enrollment_id", "occurred_at", "description", "first_aid", "urgency", "urgency_reason"]);
  const occurredAt = timestamp(body.occurred_at, "occurred_at", "Waktu kejadian");
  if (Date.parse(occurredAt) > Date.now() + 5 * 60 * 1000) invalid("occurred_at", "Waktu kejadian tidak boleh di masa depan.");
  // The Idempotency-Key makes a retried submission return the same report.
  const id = await rpc(context, "app_create_incident", {
    p_enrollment_id: uuid(body.enrollment_id, "enrollment_id", "ID pengajuan"),
    p_occurred_at: occurredAt,
    p_description: text(body.description, "description", { min: 20, max: 4000, label: "Deskripsi kejadian" }),
    p_first_aid: text(body.first_aid, "first_aid", { min: 2, max: 2000, label: "Pertolongan pertama" }),
    p_urgency: oneOf(body.urgency, "urgency", ["low", "medium", "high", "emergency"], "Tingkat urgensi"),
    p_urgency_reason: text(body.urgency_reason, "urgency_reason", { min: 5, max: 1000, label: "Alasan urgensi" }),
    p_submission_key: requestId(request),
    p_request_id: requestId(request),
  });
  return { id };
}

export async function updateIncidentStatus(context, request, id) {
  uuid(id, "incident_id", "ID laporan");
  const body = await readObject(request, ["status", "reason"]);
  await rpc(context, "app_update_incident_status", {
    p_incident_id: id,
    p_status: oneOf(body.status, "status", ["in_progress", "resolved"], "Status"),
    p_reason: text(body.reason, "reason", { min: 10, max: 1000, label: "Alasan perubahan status" }),
    p_request_id: requestId(request),
  });
  return { id, status: body.status };
}

export async function acknowledgeIncident(context, id) {
  await rpc(context, "app_parent_acknowledge_incident", { p_incident_id: uuid(id, "incident_id", "ID laporan") });
  return { id, acknowledged: true };
}
