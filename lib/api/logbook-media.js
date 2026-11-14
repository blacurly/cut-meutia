import { createHash, randomUUID } from "node:crypto";
import { ApiError, readObject } from "./http.js";
import { FOCUS_PHOTO, renderPhotoForLogbook } from "./focus.js";
import { readUpload, sniffFile } from "./uploads.js";
import { requestId, rpc, uuid } from "./validate.js";

function formValues(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiError(415, "invalid_content_type", "Unggah foto menggunakan multipart/form-data.");
  }
}

export async function uploadActivityPhoto(context, request, route) {
  const { id } = await route.params;
  const activityId = uuid(id, "activity_id", "ID catatan").toLowerCase();
  formValues(request);
  const { values, file } = await readUpload(request, ["child_id", "target_polygon"], FOCUS_PHOTO);
  const childId = uuid(values.child_id, "child_id", "ID anak").toLowerCase();
  if (typeof values.target_polygon !== "string" || values.target_polygon.length > 100_000) {
    throw new ApiError(400, "invalid_target_polygon", "Pilih siluet anak pada foto terlebih dahulu.");
  }

  const rendered = await renderPhotoForLogbook(context, file, values.target_polygon);
  const variantBytes = Buffer.from(rendered.image.base64, "base64");
  if (variantBytes.length < 1 || variantBytes.length > 8 * 1024 * 1024
      || sniffFile(variantBytes)?.mime !== rendered.image.mime_type) {
    throw new ApiError(422, "photo_render_invalid", "Hasil Foto Fokus Anak tidak dapat disimpan.");
  }

  const originalPath = `${activityId}/${randomUUID()}.${file.ext}`;
  const variantPath = `${activityId}/${childId}/${randomUUID()}.jpg`;
  const originalBucket = context.supabase.storage.from("logbook-originals");
  const variantBucket = context.supabase.storage.from("logbook-masked");

  const { error: originalError } = await originalBucket.upload(originalPath, file.bytes, {
    contentType: file.mime, cacheControl: "0", upsert: false,
  });
  if (originalError) throw new ApiError(400, "photo_upload_failed", "Foto asli belum dapat disimpan. Coba lagi.");

  const { error: variantError } = await variantBucket.upload(variantPath, variantBytes, {
    contentType: rendered.image.mime_type, cacheControl: "0", upsert: false,
  });
  if (variantError) {
    await originalBucket.remove([originalPath]);
    throw new ApiError(400, "photo_variant_upload_failed", "Hasil Foto Fokus Anak belum dapat disimpan. Coba lagi.");
  }

  try {
    const result = await rpc(context, "app_record_activity_photo", {
      p_activity_id: activityId,
      p_child_id: childId,
      p_original_path: originalPath,
      p_original_mime: file.mime,
      p_original_size: file.size,
      p_original_sha256: file.sha256,
      p_variant_path: variantPath,
      p_variant_sha256: createHash("sha256").update(variantBytes).digest("hex"),
      p_model_version: rendered.model_version,
      p_quality_flags: rendered.quality_flags,
      p_request_id: requestId(request),
    });
    return { ...result, original_mime_type: file.mime, variant_status: "processing", requires_human_review: true };
  } catch (error) {
    await variantBucket.remove([variantPath]);
    await originalBucket.remove([originalPath]);
    throw error;
  }
}

export async function listActivityPhotos(context, _request, route) {
  const { id } = await route.params;
  const rows = await rpc(context, "app_list_activity_photos", {
    p_activity_id: uuid(id, "activity_id", "ID catatan").toLowerCase(),
  });
  return Promise.all(rows.map(async photo => ({
    ...photo,
    variants: await Promise.all((photo.variants || []).map(async variant => {
      const { path: _path, bucket: _bucket, ...metadata } = variant;
      if (variant.status === "failed") return metadata;
      const { data, error } = await context.supabase.storage.from(variant.bucket).createSignedUrl(variant.path, 300);
      if (error || !data?.signedUrl) {
        throw new ApiError(404, "photo_variant_not_found", "Foto yang dapat dibagikan belum tersedia.");
      }
      return { ...metadata, url: data.signedUrl };
    })),
  })));
}

export async function reviewActivityPhoto(context, request, route) {
  const { variantId } = await route.params;
  const body = await readObject(request, ["decision"]);
  const decision = body.decision;
  if (!["ready", "failed"].includes(decision)) {
    throw new ApiError(400, "invalid_photo_review", "Keputusan tinjauan harus ready atau failed.");
  }
  const result = await rpc(context, "app_review_activity_photo_variant", {
    p_variant_id: uuid(variantId, "variant_id", "ID varian foto"),
    p_decision: decision,
    p_request_id: requestId(request),
  });
  if (decision !== "ready" || !result.original_path) return result;
  const { original_path: originalPath, ...review } = result;
  const { error } = await context.supabase.storage.from("logbook-originals").remove([originalPath]);
  return { ...review, original_deleted: !error, cleanup_pending: Boolean(error) };
}






