import { createHash, randomUUID } from "node:crypto";
import { normalizePhone } from "../auth.js";
import { ApiError, readObject } from "./http.js";
import { rpc, requestId, text, timestamp, uuid } from "./validate.js";

const MIME_EXT = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const optionalUuid = (value, field) => value == null || value === "" ? null : uuid(value, field, "ID");
const optionalTime = (value, field, label) => value == null || value === "" ? null : timestamp(value, field, label);

export async function listDelegations(context, _request, route) {
  const { id } = await route.params;
  return rpc(context, "app_manager_list_delegations", { p_daycare_id: uuid(id, "daycare_id", "ID daycare") });
}

export async function createDelegation(context, request, route) {
  const { id } = await route.params;
  const body = await readObject(request, ["grantee_id", "starts_at", "ends_at", "permissions", "reason"]);
  if (!Array.isArray(body.permissions) || body.permissions.length > 4) {
    throw new ApiError(400, "invalid_delegation", "Pilih satu sampai empat izin delegasi yang tersedia.");
  }
  const permissions = [...new Set(body.permissions.map(value => text(value, "permissions", { min: 1, max: 40, label: "Izin" })))];
  const allowed = ["manage_caregivers", "manage_assignments", "manage_daily_reports", "confirm_pickup"];
  if (permissions.some(value => !allowed.includes(value))) throw new ApiError(400, "invalid_delegation", "Izin delegasi tidak valid.");
  return rpc(context, "app_manager_create_delegation", {
    p_daycare_id: uuid(id, "daycare_id", "ID daycare"),
    p_grantee_id: uuid(body.grantee_id, "grantee_id", "ID Pengasuh"),
    p_starts_at: timestamp(body.starts_at, "starts_at", "Waktu mulai"),
    p_ends_at: timestamp(body.ends_at, "ends_at", "Waktu selesai"),
    p_permissions: permissions,
    p_reason: text(body.reason, "reason", { min: 5, max: 1000, label: "Alasan" }),
    p_request_id: requestId(request),
  });
}

export async function revokeDelegation(context, request, route) {
  const { id, delegationId } = await route.params;
  const body = await readObject(request, ["reason"]);
  return rpc(context, "app_manager_revoke_delegation", {
    p_daycare_id: uuid(id, "daycare_id", "ID daycare"),
    p_delegation_id: uuid(delegationId, "delegation_id", "ID delegasi"),
    p_reason: text(body.reason, "reason", { min: 5, max: 1000, label: "Alasan" }),
    p_request_id: requestId(request),
  });
}

export async function listPickupAuthorizations(context, _request, route) {
  const { id } = await route.params;
  return rpc(context, "app_parent_list_pickup_authorizations", { p_child_id: uuid(id, "child_id", "ID anak") });
}

export async function createPickupAuthorization(context, request, route) {
  const { id } = await route.params;
  const body = await readObject(request, ["name", "phone", "relationship", "permission_type", "valid_from", "valid_until", "enrollment_id"]);
  const phone = normalizePhone(body.phone);
  if (!/^8\d{8,11}$/.test(phone)) throw new ApiError(400, "invalid_pickup_authorization", "Masukkan nomor WhatsApp Indonesia yang valid.");
  return rpc(context, "app_parent_create_pickup_authorization", {
    p_child_id: uuid(id, "child_id", "ID anak"),
    p_name: text(body.name, "name", { min: 2, max: 100, label: "Nama penjemput" }),
    p_phone: phone,
    p_relationship: text(body.relationship, "relationship", { min: 2, max: 60, label: "Hubungan" }),
    p_permission_type: body.permission_type,
    p_valid_from: timestamp(body.valid_from, "valid_from", "Waktu mulai izin"),
    p_valid_until: optionalTime(body.valid_until, "valid_until", "Waktu akhir izin"),
    p_enrollment_id: optionalUuid(body.enrollment_id, "enrollment_id"),
    p_request_id: requestId(request),
  });
}

export async function revokePickupAuthorization(context, request, route) {
  const { authorizationId } = await route.params;
  return rpc(context, "app_parent_revoke_pickup_authorization", {
    p_authorization_id: uuid(authorizationId, "authorization_id", "ID izin penjemput"),
    p_request_id: requestId(request),
  });
}

function validImageSignature(type, bytes) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return type === "image/webp" && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
}

export async function listEnrollmentPickups(context, _request, route) {
  const { id } = await route.params;
  const rows = await rpc(context, "app_list_enrollment_pickups", { p_enrollment_id: uuid(id, "enrollment_id", "ID pengajuan") });
  return Promise.all(rows.map(async pickup => ({
    ...pickup,
    attachments: await Promise.all((pickup.attachments || []).map(async attachment => {
      const { data, error } = await context.supabase.storage.from(attachment.bucket).createSignedUrl(attachment.path, 300);
      if (error || !data?.signedUrl) throw new ApiError(404, "pickup_evidence_not_found", "Bukti penjemputan tidak tersedia.");
      return { id: attachment.id, mime_type: attachment.mime_type, byte_size: attachment.byte_size, url: data.signedUrl };
    })),
  })));
}

export async function recordEnrollmentPickup(context, request, route) {
  const { id } = await route.params;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiError(415, "invalid_content_type", "Catat penjemputan menggunakan form-data.");
  }
  let form;
  try { form = await request.formData(); } catch { throw new ApiError(400, "invalid_pickup_record", "Form penjemputan tidak valid."); }

  const enrollmentId = uuid(id, "enrollment_id", "ID pengajuan");
  const verificationStatus = form.get("verification_status");
  if (!["failed", "verified"].includes(verificationStatus)) throw new ApiError(400, "invalid_pickup_record", "Status verifikasi harus failed atau verified.");
  const collectorSnapshot = {
    name: text(form.get("collector_name"), "collector_name", { min: 2, max: 100, label: "Nama penjemput" }),
    phone: normalizePhone(text(form.get("collector_phone"), "collector_phone", { min: 8, max: 17, label: "Nomor telepon" })),
    relationship: text(form.get("relationship"), "relationship", { min: 2, max: 60, label: "Hubungan" }),
    source: text(form.get("source"), "source", { min: 1, max: 20, label: "Sumber identitas" }),
  };
  if (!/^8\d{8,11}$/.test(collectorSnapshot.phone)) throw new ApiError(400, "invalid_pickup_record", "Masukkan nomor WhatsApp Indonesia yang valid.");
  if (!["parent", "authorized", "unknown"].includes(collectorSnapshot.source)) throw new ApiError(400, "invalid_pickup_record", "Sumber identitas tidak valid.");
  const authorizationValue = form.get("authorization_id");
  const authorizationId = authorizationValue ? uuid(authorizationValue, "authorization_id", "ID izin penjemput") : null;
  const note = text(form.get("verification_note"), "verification_note", { min: 5, max: 1000, label: "Catatan verifikasi" });
  let objectPath = null, mimeType = null, byteSize = null, sha256 = null;

  if (verificationStatus === "verified") {
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > 8 * 1024 * 1024 || !MIME_EXT.has(file.type)) {
      throw new ApiError(400, "invalid_pickup_evidence", "Bukti harus berupa foto JPG, PNG, atau WEBP maksimal 8 MB.");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!validImageSignature(file.type, bytes)) throw new ApiError(400, "invalid_pickup_evidence", "Isi file tidak cocok dengan format foto.");
    const scope = await rpc(context, "app_get_pickup_upload_scope", { p_enrollment_id: enrollmentId });
    objectPath = `${scope.daycare_id}/${enrollmentId}/${randomUUID()}.${MIME_EXT.get(file.type)}`;
    mimeType = file.type;
    byteSize = file.size;
    sha256 = createHash("sha256").update(bytes).digest("hex");
    const { error } = await context.supabase.storage.from("pickup-evidence").upload(objectPath, bytes, {
      contentType: mimeType, cacheControl: "0", upsert: false,
    });
    if (error) throw new ApiError(400, "pickup_upload_failed", "Foto bukti belum dapat diunggah. Coba lagi.");
  }

  try {
    return await rpc(context, "app_record_enrollment_pickup", {
      p_enrollment_id: enrollmentId, p_authorization_id: authorizationId,
      p_collector_snapshot: collectorSnapshot, p_verification_status: verificationStatus,
      p_verification_note: note, p_object_path: objectPath, p_mime_type: mimeType,
      p_byte_size: byteSize, p_sha256: sha256, p_request_id: requestId(request),
    });
  } catch (error) {
    if (objectPath) await context.supabase.storage.from("pickup-evidence").remove([objectPath]);
    throw error;
  }
}

export async function listComplaints(context, _request) {
  return rpc(context, "app_list_my_complaints");
}

export async function createComplaint(context, request) {
  const body = await readObject(request, ["category", "priority", "subject", "description", "enrollment_id", "incident_id", "daycare_id"]);
  return rpc(context, "app_parent_create_complaint", {
    p_category: body.category,
    p_priority: body.priority,
    p_subject: text(body.subject, "subject", { min: 5, max: 160, label: "Subjek" }),
    p_description: text(body.description, "description", { min: 20, max: 5000, label: "Deskripsi" }),
    p_enrollment_id: optionalUuid(body.enrollment_id, "enrollment_id"),
    p_incident_id: optionalUuid(body.incident_id, "incident_id"),
    p_daycare_id: optionalUuid(body.daycare_id, "daycare_id"),
    p_request_id: requestId(request),
  });
}

export async function updateMyComplaint(context, request, route) {
  const { id } = await route.params;
  const body = await readObject(request, ["action", "reason", "response_text"]);
  return rpc(context, "app_update_complaint", {
    p_complaint_id: uuid(id, "complaint_id", "ID laporan"),
    p_action: body.action,
    p_reason: text(body.reason, "reason", { min: 5, max: 1000, label: "Alasan" }),
    p_response_text: text(body.response_text, "response_text", { min: 1, max: 5000, label: "Respons", optional: true }),
    p_request_id: requestId(request),
  });
}

export async function listAdminComplaints(context, request) {
  const query = new URL(request.url).searchParams;
  return rpc(context, "app_admin_list_complaints", {
    p_status: query.get("status") || null,
    p_priority: query.get("priority") || null,
  });
}

export async function updateAdminComplaint(context, request, route) {
  const { id } = await route.params;
  const body = await readObject(request, ["action", "reason", "response_text", "admin_id"]);
  const complaintId = uuid(id, "complaint_id", "ID laporan");
  const reason = text(body.reason, "reason", { min: 5, max: 1000, label: "Alasan" });
  if (body.action === "assign") return rpc(context, "app_admin_assign_complaint", {
    p_complaint_id: complaintId, p_admin_id: uuid(body.admin_id, "admin_id", "ID Admin"),
    p_reason: reason, p_request_id: requestId(request),
  });
  return rpc(context, "app_update_complaint", {
    p_complaint_id: complaintId, p_action: body.action, p_reason: reason,
    p_response_text: text(body.response_text, "response_text", { min: 1, max: 5000, label: "Isi respons", optional: true }),
    p_request_id: requestId(request),
  });
}

export async function listInvestigations(context, request) {
  return rpc(context, "app_admin_list_investigations", { p_status: new URL(request.url).searchParams.get("status") || null });
}

export async function createInvestigation(context, request) {
  const body = await readObject(request, ["complaint_id", "incident_id", "scope", "assigned_admin_id"]);
  const id = await rpc(context, "app_admin_create_investigation", {
    p_complaint_id: optionalUuid(body.complaint_id, "complaint_id"),
    p_incident_id: optionalUuid(body.incident_id, "incident_id"),
    p_scope: text(body.scope, "scope", { min: 10, max: 2000, label: "Ruang lingkup" }),
    p_assigned_admin_id: optionalUuid(body.assigned_admin_id, "assigned_admin_id"),
    p_request_id: requestId(request),
  });
  return { id };
}

export async function updateInvestigation(context, request, route) {
  const { id } = await route.params;
  const body = await readObject(request, ["status", "findings", "recommendation", "reason"]);
  return rpc(context, "app_admin_update_investigation", {
    p_investigation_id: uuid(id, "investigation_id", "ID investigasi"),
    p_status: body.status,
    p_findings: text(body.findings, "findings", { max: 10000, label: "Temuan", optional: true }),
    p_recommendation: text(body.recommendation, "recommendation", { max: 5000, label: "Rekomendasi", optional: true }),
    p_reason: text(body.reason, "reason", { min: 5, max: 1000, label: "Alasan" }),
    p_request_id: requestId(request),
  });
}

async function uploadCaseFile(context, request, targetId, kind) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiError(415, "invalid_content_type", "Unggah bukti menggunakan form-data.");
  }
  let form;
  try { form = await request.formData(); } catch { throw new ApiError(400, "invalid_case_evidence", "Form bukti tidak valid."); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > 10 * 1024 * 1024 ||
    !["application/pdf", ...MIME_EXT.keys()].includes(file.type)) {
    throw new ApiError(400, "invalid_case_evidence", "Bukti harus PDF, JPG, PNG, atau WEBP maksimal 10 MB.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const signature = file.type === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-" : validImageSignature(file.type, bytes);
  if (!signature) throw new ApiError(400, "invalid_case_evidence", "Isi file tidak cocok dengan format yang dipilih.");
  const folder = kind === "complaint" ? "complaints" : "investigations";
  const path = `${folder}/${targetId}/${randomUUID()}.${file.type === "application/pdf" ? "pdf" : MIME_EXT.get(file.type)}`;
  const { error } = await context.supabase.storage.from("case-evidence").upload(path, bytes, {
    contentType: file.type, cacheControl: "0", upsert: false,
  });
  if (error) throw new ApiError(400, "case_evidence_upload_failed", "Bukti belum dapat diunggah. Coba lagi.");
  const args = {
    p_object_path: path, p_mime_type: file.type, p_byte_size: file.size,
    p_sha256: createHash("sha256").update(bytes).digest("hex"), p_request_id: requestId(request),
  };
  try {
    const attachmentId = kind === "complaint"
      ? await rpc(context, "app_attach_complaint_evidence", { ...args, p_complaint_id: targetId })
      : await rpc(context, "app_admin_attach_investigation_evidence", { ...args, p_investigation_id: targetId });
    return { id: attachmentId };
  } catch (error) {
    await context.supabase.storage.from("case-evidence").remove([path]);
    throw error;
  }
}

export async function uploadComplaintEvidence(context, request, route) {
  const { id } = await route.params;
  return uploadCaseFile(context, request, uuid(id, "complaint_id", "ID laporan"), "complaint");
}

export async function listComplaintEvidence(context, _request, route) {
  const { id } = await route.params;
  const rows = await rpc(context, "app_list_complaint_evidence", { p_complaint_id: uuid(id, "complaint_id", "ID laporan") });
  return signCaseEvidence(context, rows);
}

export async function uploadInvestigationEvidence(context, request, route) {
  const { id } = await route.params;
  return uploadCaseFile(context, request, uuid(id, "investigation_id", "ID investigasi"), "investigation");
}

export async function listInvestigationEvidence(context, _request, route) {
  const { id } = await route.params;
  const rows = await rpc(context, "app_admin_list_investigation_evidence", { p_investigation_id: uuid(id, "investigation_id", "ID investigasi") });
  return signCaseEvidence(context, rows);
}

async function signCaseEvidence(context, rows) {
  return Promise.all(rows.map(async row => {
    const { data, error } = await context.supabase.storage.from(row.bucket).createSignedUrl(row.path, 300);
    if (error || !data?.signedUrl) throw new ApiError(404, "case_evidence_not_found", "Bukti kasus tidak tersedia.");
    return { id: row.id, mime_type: row.mime_type, byte_size: row.byte_size, url: data.signedUrl };
  }));
}

export async function listAdminSanctions(context) {
  const rows = await rpc(context, "app_admin_list_sanctions");
  return Promise.all(rows.map(async row => ({ ...row,
    evidence: await signCaseEvidence(context, row.evidence || []),
  })));
}

export async function createAdminSanction(context, request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiError(415, "invalid_content_type", "Buat sanksi menggunakan form-data agar bukti wajib disertakan.");
  }
  let form;
  try { form = await request.formData(); } catch { throw new ApiError(400, "invalid_sanction", "Form sanksi tidak valid."); }
  const targetUser = optionalUuid(form.get("target_user_id"), "target_user_id");
  const targetDaycare = optionalUuid(form.get("target_daycare_id"), "target_daycare_id");
  const investigation = optionalUuid(form.get("investigation_id"), "investigation_id");
  if ((targetUser == null) === (targetDaycare == null)) throw new ApiError(400, "invalid_sanction", "Pilih tepat satu target: akun atau daycare.");
  const type = text(form.get("sanction_type"), "sanction_type", { min: 1, max: 20, label: "Jenis sanksi" });
  if (!["freeze", "block"].includes(type)) throw new ApiError(400, "invalid_sanction", "Jenis sanksi harus freeze atau block.");
  const reason = text(form.get("reason"), "reason", { min: 10, max: 2000, label: "Alasan" });
  const startsAt = timestamp(form.get("starts_at"), "starts_at", "Waktu mulai");
  const endsAt = optionalTime(form.get("ends_at"), "ends_at", "Waktu akhir");
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > 10 * 1024 * 1024 ||
    !["application/pdf", ...MIME_EXT.keys()].includes(file.type)) {
    throw new ApiError(400, "invalid_case_evidence", "Bukti sanksi wajib berupa PDF, JPG, PNG, atau WEBP maksimal 10 MB.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!(file.type === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-" : validImageSignature(file.type, bytes))) {
    throw new ApiError(400, "invalid_case_evidence", "Isi file tidak cocok dengan format yang dipilih.");
  }
  const path = `sanctions/${randomUUID()}/${randomUUID()}.${file.type === "application/pdf" ? "pdf" : MIME_EXT.get(file.type)}`;
  const { error } = await context.supabase.storage.from("case-evidence").upload(path, bytes, { contentType: file.type, cacheControl: "0", upsert: false });
  if (error) throw new ApiError(400, "case_evidence_upload_failed", "Bukti sanksi belum dapat diunggah. Coba lagi.");
  try {
    return await rpc(context, "app_admin_create_sanction", {
      p_target_user_id: targetUser, p_target_daycare_id: targetDaycare, p_investigation_id: investigation,
      p_sanction_type: type, p_reason: reason, p_starts_at: startsAt, p_ends_at: endsAt,
      p_object_path: path, p_mime_type: file.type, p_byte_size: file.size,
      p_sha256: createHash("sha256").update(bytes).digest("hex"), p_request_id: requestId(request),
    });
  } catch (error) {
    await context.supabase.storage.from("case-evidence").remove([path]);
    throw error;
  }
}

export async function revokeAdminSanction(context, request, route) {
  const { id } = await route.params;
  const body = await readObject(request, ["reason"]);
  return rpc(context, "app_admin_revoke_sanction", {
    p_sanction_id: uuid(id, "sanction_id", "ID sanksi"),
    p_reason: text(body.reason, "reason", { min: 5, max: 2000, label: "Alasan pencabutan" }),
    p_request_id: requestId(request),
  });
}
