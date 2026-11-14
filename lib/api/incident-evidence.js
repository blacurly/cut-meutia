import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "./http.js";
import { sniffFile } from "./uploads.js";
import { requestId, rpc, uuid } from "./validate.js";

const MAX_BYTES = 10 * 1024 * 1024;

function requireMultipart(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiError(415, "invalid_content_type", "Unggah bukti insiden menggunakan multipart/form-data.");
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BYTES + 64 * 1024) {
    throw new ApiError(413, "invalid_incident_evidence", "Foto bukti maksimal 10 MB.");
  }
}

export async function listIncidentEvidence(context, _request, route) {
  const { id } = await route.params;
  const items = await rpc(context, "app_list_incident_evidence", {
    p_incident_id: uuid(id, "incident_id", "ID insiden").toLowerCase(),
  });
  return Promise.all(items.map(async item => {
    const { data, error } = await context.supabase.storage.from(item.bucket).createSignedUrl(item.path, 300);
    if (error || !data?.signedUrl) {
      throw new ApiError(404, "incident_evidence_not_found", "Bukti insiden tidak tersedia.");
    }
    const { path: _path, bucket: _bucket, ...metadata } = item;
    return { ...metadata, url: data.signedUrl };
  }));
}

export async function uploadIncidentEvidence(context, request, route) {
  const { id } = await route.params;
  const incidentId = uuid(id, "incident_id", "ID insiden").toLowerCase();
  requireMultipart(request);
  let form;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, "invalid_incident_evidence", "Form bukti insiden tidak valid.");
  }
  if ([...form.keys()].some(key => key !== "file")) {
    throw new ApiError(400, "invalid_fields", "Form hanya boleh berisi satu foto dengan nama field file.");
  }
  const files = form.getAll("file");
  const file = files[0];
  if (files.length !== 1 || !(file instanceof File) || file.size < 1 || file.size > MAX_BYTES) {
    throw new ApiError(400, "invalid_incident_evidence", "Unggah satu foto maksimal 10 MB.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = sniffFile(bytes);
  if (!detected || !["image/jpeg", "image/png", "image/webp"].includes(detected.mime)) {
    throw new ApiError(400, "invalid_incident_evidence", "Bukti harus berupa foto JPG, PNG, atau WebP yang valid.");
  }

  const path = `${incidentId}/${randomUUID()}.${detected.ext}`;
  const bucket = context.supabase.storage.from("incident-evidence");
  const { error } = await bucket.upload(path, bytes, {
    contentType: detected.mime, cacheControl: "0", upsert: false,
  });
  if (error) throw new ApiError(400, "incident_evidence_upload_failed", "Bukti insiden belum dapat diunggah. Coba lagi.");

  try {
    const attachmentId = await rpc(context, "app_attach_incident_evidence", {
      p_incident_id: incidentId,
      p_object_path: path,
      p_mime_type: detected.mime,
      p_byte_size: bytes.length,
      p_sha256: createHash("sha256").update(bytes).digest("hex"),
      p_request_id: requestId(request),
    });
    return { id: attachmentId, mime_type: detected.mime, byte_size: bytes.length };
  } catch (error) {
    await bucket.remove([path]);
    throw error;
  }
}


