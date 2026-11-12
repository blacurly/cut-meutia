import { createHash, randomUUID } from "node:crypto";
import { ApiError, readObject } from "./http.js";
import { isoDate, rpc, requestId, text, uuid } from "./validate.js";

const DOCUMENT_TYPES = ["business_license", "operational_license", "tax_document", "insurance", "other"];
const DOCUMENT_MIMES = new Map([["application/pdf", "pdf"], ["image/jpeg", "jpg"], ["image/png", "png"]]);
const PHOTO_MIMES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

const routeId = (params, key = "id") => uuid(params?.[key], key);
const reason = value => text(value, "reason", { min: 5, max: 1000, label: "Alasan" });

export async function getPartnerOnboarding(context, _request, route) {
  const { id } = await route.params;
  return rpc(context, "app_manager_get_partner_onboarding", { p_daycare_id: routeId({ id }) });
}

export async function updatePartnerProfile(context, request, route) {
  const { id } = await route.params;
  const fields = ["name", "description", "address", "contact_phone", "facilities", "opening_hours", "daily_capacity"];
  const body = await readObject(request, fields);
  if (!Array.isArray(body.facilities) || !body.opening_hours || Array.isArray(body.opening_hours) || typeof body.opening_hours !== "object") {
    throw new ApiError(400, "invalid_partner_profile", "Fasilitas dan jam operasional daycare tidak valid.");
  }
  return rpc(context, "app_manager_update_partner_profile", {
    p_daycare_id: routeId({ id }), p_payload: body, p_request_id: requestId(request),
  });
}

export async function listOfferings(context, _request, route) {
  const { id } = await route.params;
  return rpc(context, "app_manager_list_offerings", { p_daycare_id: routeId({ id }) });
}

export async function saveOffering(context, request, route) {
  const { id } = await route.params;
  const fields = ["offering_id", "name", "service_type", "description", "min_age_months", "max_age_months", "is_active", "service_amount", "late_pickup_terms"];
  const body = await readObject(request, fields);
  const offeringId = body.offering_id == null ? null : uuid(body.offering_id, "offering_id", "ID layanan");
  const { offering_id, ...payload } = body;
  return rpc(context, "app_manager_save_offering", {
    p_daycare_id: routeId({ id }), p_offering_id: offeringId,
    p_payload: payload, p_request_id: requestId(request),
  });
}

export async function decidePartnerStatus(context, request, route) {
  const { id } = await route.params;
  const body = await readObject(request, ["status", "reason"]);
  const status = text(body.status, "status", { min: 1, max: 20, label: "Status" });
  if (!["active", "inactive", "suspended"].includes(status)) throw new ApiError(400, "invalid_partner_status", "Status daycare tidak valid.");
  return rpc(context, "app_admin_update_partner_status", {
    p_daycare_id: routeId({ id }), p_status: status, p_reason: reason(body.reason), p_request_id: requestId(request),
  });
}

export async function decidePrice(context, request, route) {
  const { id } = await route.params;
  const body = await readObject(request, ["decision", "reason"]);
  const decision = text(body.decision, "decision", { min: 1, max: 20, label: "Keputusan" });
  if (!["approved", "rejected"].includes(decision)) throw new ApiError(400, "invalid_price_decision", "Keputusan harga tidak valid.");
  return rpc(context, "app_admin_decide_service_price", {
    p_price_version_id: routeId({ id }), p_decision: decision,
    p_reason: reason(body.reason), p_request_id: requestId(request),
  });
}

export async function listDocuments(context, _request, route) {
  const { id } = await route.params;
  return rpc(context, "app_manager_list_documents", { p_daycare_id: routeId({ id }) });
}

export async function submitDocument(context, request, route) {
  const { id } = await route.params;
  const daycareId = routeId({ id });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiError(415, "invalid_content_type", "Unggah dokumen dalam format form-data.");
  }
  let form;
  try { form = await request.formData(); } catch { throw new ApiError(400, "invalid_document", "Form unggah dokumen tidak valid."); }
  const file = form.get("file");
  const documentType = text(form.get("document_type"), "document_type", { min: 2, max: 40, label: "Jenis dokumen" });
  if (!DOCUMENT_TYPES.includes(documentType)) throw new ApiError(400, "invalid_daycare_document", "Jenis dokumen tidak didukung.");
  if (!(file instanceof File) || file.size < 1 || file.size > 15 * 1024 * 1024 || !DOCUMENT_MIMES.has(file.type)) {
    throw new ApiError(400, "invalid_daycare_document", "File harus PDF, JPG, atau PNG dan berukuran maksimal 15 MB.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const signatureOk = file.type === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-"
    : file.type === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8
      : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!signatureOk) throw new ApiError(400, "invalid_daycare_document", "Isi file tidak sesuai dengan jenis file yang dipilih.");

  const path = `${daycareId}/${randomUUID()}.${DOCUMENT_MIMES.get(file.type)}`;
  const { error: uploadError } = await context.supabase.storage.from("daycare-documents").upload(path, bytes, {
    contentType: file.type, cacheControl: "0", upsert: false,
  });
  if (uploadError) throw new ApiError(400, "document_upload_failed", "File belum dapat diunggah. Periksa izin dan coba lagi.");

  const optional = key => {
    const value = form.get(key);
    if (value == null || value === "") return null;
    if (key === "valid_from" || key === "expires_on") return isoDate(value, key, key === "valid_from" ? "Tanggal terbit" : "Tanggal kedaluwarsa");
    return text(value, key, { max: key === "issuer" ? 200 : 100, label: key });
  };
  try {
    return await rpc(context, "app_manager_submit_daycare_document", {
      p_daycare_id: daycareId, p_document_type: documentType,
      p_document_number: optional("document_number"), p_issuer: optional("issuer"),
      p_valid_from: optional("valid_from"), p_expires_on: optional("expires_on"),
      p_object_path: path, p_mime_type: file.type, p_byte_size: file.size,
      p_sha256: createHash("sha256").update(bytes).digest("hex"), p_request_id: requestId(request),
    });
  } catch (error) {
    await context.supabase.storage.from("daycare-documents").remove([path]);
    throw error;
  }
}

export async function listAdminDocuments(context, request) {
  const value = new URL(request.url).searchParams.get("daycare_id");
  return rpc(context, "app_admin_list_daycare_documents", {
    p_daycare_id: value ? uuid(value, "daycare_id", "ID daycare") : null,
  });
}

export async function decideDocument(context, request, route) {
  const { id } = await route.params;
  const body = await readObject(request, ["decision", "reason"]);
  const decision = text(body.decision, "decision", { min: 1, max: 30, label: "Keputusan" });
  if (!["approved", "rejected", "revision_required"].includes(decision)) throw new ApiError(400, "invalid_document_decision", "Keputusan dokumen tidak valid.");
  return rpc(context, "app_admin_decide_daycare_document", {
    p_document_id: routeId({ id }), p_decision: decision,
    p_reason: reason(body.reason), p_request_id: requestId(request),
  });
}

export async function getDocumentFile(context, _request, route) {
  const { id } = await route.params;
  const file = await rpc(context, "app_get_daycare_document_file", { p_document_id: routeId({ id }) });
  const { data, error } = await context.supabase.storage.from(file.bucket).createSignedUrl(file.path, 300);
  if (error || !data?.signedUrl) throw new ApiError(404, "daycare_document_not_found", "File dokumen tidak ditemukan.");
  return { url: data.signedUrl, expires_in: 300, mime_type: file.mime_type };
}

export async function listStaff(context, _request, route) {
  const { id } = await route.params;
  return rpc(context, "app_manager_list_staff", { p_daycare_id: routeId({ id }) });
}

export async function inviteCaregiver(context, request, route) {
  const { id } = await route.params;
  const body = await readObject(request, ["email"]);
  const email = text(body.email, "email", { min: 5, max: 254, label: "Email Pengasuh" }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "invalid_invitation", "Email Pengasuh tidak valid.");
  const token = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const invitation = await rpc(context, "app_manager_invite_caregiver", {
    p_daycare_id: routeId({ id }), p_email: email, p_token_hash: tokenHash,
    p_expires_at: expiresAt, p_request_id: requestId(request),
  });
  return { ...invitation, invitation_token: token };
}

export async function endCaregiver(context, request, route) {
  const { id, memberId } = await route.params;
  const body = await readObject(request, ["reason"]);
  return rpc(context, "app_manager_end_caregiver", {
    p_daycare_id: routeId({ id }), p_member_id: uuid(memberId, "member_id", "ID staf"),
    p_reason: reason(body.reason), p_request_id: requestId(request),
  });
}

export const listPendingPrices = context => rpc(context, "app_admin_list_pending_prices");
export const listPendingCaregivers = context => rpc(context, "app_admin_list_pending_caregivers");

export async function verifyCaregiver(context, request, route) {
  const { id } = await route.params;
  const body = await readObject(request, ["decision", "reason"]);
  const decision = text(body.decision, "decision", { min: 1, max: 20, label: "Keputusan" });
  if (!["approved", "rejected"].includes(decision)) throw new ApiError(400, "invalid_caregiver_decision", "Keputusan Pengasuh tidak valid.");
  return rpc(context, "app_admin_verify_caregiver", {
    p_member_id: uuid(id, "member_id", "ID staf"), p_decision: decision,
    p_reason: reason(body.reason), p_request_id: requestId(request),
  });
}

async function signedPhoto(context, path) {
  const { data, error } = await context.supabase.storage.from("daycare-gallery").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new ApiError(404, "daycare_photo_not_found", "Foto daycare tidak tersedia.");
  return data.signedUrl;
}

export async function listManagerPhotos(context, _request, route) {
  const { id } = await route.params;
  const rows = await rpc(context, "app_manager_list_daycare_photos", { p_daycare_id: routeId({ id }) });
  return Promise.all(rows.map(async photo => ({ ...photo, url: await signedPhoto(context, photo.path), path: undefined })));
}

export async function submitDaycarePhoto(context, request, route) {
  const { id } = await route.params;
  const daycareId = routeId({ id });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiError(415, "invalid_content_type", "Unggah foto dalam format form-data.");
  }
  let form;
  try { form = await request.formData(); } catch { throw new ApiError(400, "invalid_daycare_photo", "Form unggah foto tidak valid."); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > 8 * 1024 * 1024 || !PHOTO_MIMES.has(file.type)) {
    throw new ApiError(400, "invalid_daycare_photo", "Foto harus JPG, PNG, atau WEBP dengan ukuran maksimal 8 MB.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const signatureOk = file.type === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8
    : file.type === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!signatureOk) throw new ApiError(400, "invalid_daycare_photo", "Isi file tidak sesuai dengan jenis foto yang dipilih.");
  const path = `${daycareId}/${randomUUID()}.${PHOTO_MIMES.get(file.type)}`;
  const { error } = await context.supabase.storage.from("daycare-gallery").upload(path, bytes, {
    contentType: file.type, cacheControl: "0", upsert: false,
  });
  if (error) throw new ApiError(400, "photo_upload_failed", "Foto belum dapat diunggah. Coba lagi.");
  const rawCaption = form.get("caption");
  const caption = rawCaption == null || rawCaption === "" ? null
    : text(rawCaption, "caption", { max: 160, label: "Keterangan foto", optional: true });
  try {
    return await rpc(context, "app_manager_submit_daycare_photo", {
      p_daycare_id: daycareId, p_object_path: path, p_caption: caption,
      p_request_id: requestId(request),
    });
  } catch (error) {
    await context.supabase.storage.from("daycare-gallery").remove([path]);
    throw error;
  }
}

export async function listPublicDaycarePhotos(context, _request, route) {
  const { id } = await route.params;
  const photos = await rpc(context, "app_list_public_daycare_photos", { p_daycare_id: routeId({ id }) });
  return Promise.all(photos.map(async photo => ({ caption: photo.caption,
    display_order: photo.display_order, url: await signedPhoto(context, photo.path) })));
}

export async function listPendingPhotos(context) {
  const photos = await rpc(context, "app_admin_list_pending_daycare_photos");
  return Promise.all(photos.map(async photo => ({ ...photo, url: await signedPhoto(context, photo.path), path: undefined })));
}

export async function decidePhoto(context, request, route) {
  const { id } = await route.params;
  const body = await readObject(request, ["decision", "reason"]);
  const decision = text(body.decision, "decision", { min: 1, max: 20, label: "Keputusan" });
  if (!["approved", "rejected"].includes(decision)) throw new ApiError(400, "invalid_photo_decision", "Keputusan foto tidak valid.");
  return rpc(context, "app_admin_decide_daycare_photo", {
    p_photo_id: routeId({ id }), p_decision: decision,
    p_reason: reason(body.reason), p_request_id: requestId(request),
  });
}
