// /api/enrollments — child enrollment lifecycle (non-AI).
// Parent: create, read own, cancel while pending, start a payment.
// Manager: queue for own daycare (child identity hidden until approved),
// decide, assign caregiver, check in, complete.
import { readObject, readOptionalObject } from "./http.js";
import { reject } from "./errors.js";
import { ENROLLMENT_CONSENT, consentWording } from "../enrollment-consent.js";
import { invalid, isoDate, oneOf, requestId, rpc, text, timestamp, todayJakarta, uuid } from "./validate.js";

export async function listEnrollments(context, searchParams) {
  const daycareId = searchParams.get("daycare_id");
  return rpc(context, "app_list_enrollments", { p_daycare_id: daycareId ? uuid(daycareId, "daycare_id", "ID daycare") : null });
}

export async function getEnrollment(context, id) {
  return rpc(context, "app_get_enrollment", { p_enrollment_id: uuid(id, "enrollment_id", "ID pengajuan") });
}

export async function createEnrollment(context, request) {
  const body = await readObject(request, ["child_id", "offering_id", "service_date", "consents"]);
  const childId = uuid(body.child_id, "child_id", "ID anak");
  const offeringId = uuid(body.offering_id, "offering_id", "ID layanan");
  const serviceDate = isoDate(body.service_date, "service_date", "Tanggal layanan");
  if (serviceDate < todayJakarta()) reject("invalid_service_date");
  const consents = body.consents;
  if (!consents || typeof consents !== "object"
      || Object.keys(ENROLLMENT_CONSENT.items).some(key => consents[key] !== true)) {
    reject("invalid_consent");
  }
  const id = await rpc(context, "app_create_enrollment", {
    p_child_id: childId,
    p_offering_id: offeringId,
    p_service_date: serviceDate,
    p_policy_version: ENROLLMENT_CONSENT.version,
    p_consent_scope: { service_terms: true, child_data_processing: true, policy_version: ENROLLMENT_CONSENT.version },
    p_wording_snapshot: consentWording(),
    p_request_id: requestId(request),
  });
  return getEnrollment(context, id);
}

const ACTIONS = ["decide", "assign_caregiver", "check_in", "complete"];

export async function updateEnrollment(context, request, id) {
  uuid(id, "enrollment_id", "ID pengajuan");
  const body = await readObject(request, ["action", "decision", "reason", "caregiver_id", "starts_at", "ends_at"]);
  const action = oneOf(body.action, "action", ACTIONS, "Aksi");
  const p_request_id = requestId(request);
  if (action === "decide") {
    await rpc(context, "app_manager_decide_enrollment", {
      p_enrollment_id: id,
      p_decision: oneOf(body.decision, "decision", ["accepted", "rejected"], "Keputusan"),
      p_reason: text(body.reason, "reason", { min: 5, max: 500, label: "Alasan keputusan" }),
      p_request_id,
    });
  } else if (action === "assign_caregiver") {
    const startsAt = timestamp(body.starts_at, "starts_at", "Waktu mulai");
    const endsAt = timestamp(body.ends_at, "ends_at", "Waktu selesai");
    if (startsAt >= endsAt) invalid("assignment_period", "Waktu selesai harus setelah waktu mulai.");
    await rpc(context, "app_manager_assign_caregiver", {
      p_enrollment_id: id, p_caregiver_id: uuid(body.caregiver_id, "caregiver_id", "ID pengasuh"),
      p_starts_at: startsAt, p_ends_at: endsAt, p_request_id,
    });
  } else if (action === "check_in") {
    await rpc(context, "app_manager_check_in_enrollment", { p_enrollment_id: id, p_request_id });
  } else {
    await rpc(context, "app_manager_complete_enrollment", {
      p_enrollment_id: id,
      p_reason: text(body.reason, "reason", { max: 500, label: "Catatan penyelesaian", optional: true }),
      p_request_id,
    });
  }
  return getEnrollment(context, id);
}

// Parent self-cancel, allowed only while the enrollment is pending.
export async function cancelEnrollment(context, request, id) {
  uuid(id, "enrollment_id", "ID pengajuan");
  const body = await readOptionalObject(request, ["reason"]);
  await rpc(context, "app_parent_cancel_enrollment", {
    p_enrollment_id: id,
    p_reason: text(body.reason, "reason", { max: 500, label: "Alasan pembatalan", optional: true }),
    p_request_id: requestId(request),
  });
  return getEnrollment(context, id);
}

// Records a payment attempt for the enrollment's open charge. No payment
// gateway is configured yet; an Admin confirms the result manually.
export async function createPayment(context, request, id) {
  const body = await readObject(request, ["method"]);
  const method = oneOf(body.method, "method", ["va", "qris", "ewallet"], "Metode pembayaran");
  const enrollment = await getEnrollment(context, id);
  if (!enrollment.charge || enrollment.charge.status !== "open") reject("charge_not_payable");
  const dueAt = Date.parse(enrollment.charge.due_at);
  const expiresAt = new Date(Math.min(Date.now() + 60 * 60 * 1000, dueAt)).toISOString();
  const transactionId = await rpc(context, "app_create_payment_ledger_entry", {
    p_charge_id: enrollment.charge.id,
    p_method: method,
    p_idempotency_key: `${id}:${requestId(request)}`,
    p_expires_at: expiresAt,
  });
  return {
    transaction_id: transactionId,
    amount: enrollment.charge.total_amount,
    currency: enrollment.charge.currency,
    method,
    expires_at: expiresAt,
    status: "created",
  };
}
