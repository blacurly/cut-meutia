// POST /api/enrollments/{id}/activities/{activityId}/ai-draft
//
// Logbook Drafter (contract v1 "logbook_draft"). The assigned caregiver writes
// short notes in a saved draft activity (one observation per line) and asks
// for a draft addressed to the parent. The server:
//   1. reads the activity from the database as the caller. Caregivers only
//      see their own activities, and only while assigned (RPC + RLS), so the
//      source cannot be swapped for someone else's data;
//   2. turns the notes and meal/sleep details into the contract input;
//   3. runs the language model (lib/ai/run.js: contract validation, retry,
//      fact-index check);
//   4. records the job in ai_jobs (migration 20261117100000, skipped with a
//      warning while that migration is not applied);
//   5. returns the proposal. Nothing is written to the activity here: the
//      caregiver edits and saves it with PATCH .../activities/{activityId}.
import { ApiError } from "./http.js";
import { databaseData } from "./errors.js";
import { rpc, uuid } from "./validate.js";
import { AiError } from "../ai/errors.js";
import { FEATURES } from "../ai/features.js";
import { getProvider } from "../ai/providers/index.js";
import { takeToken } from "../ai/rate-limit.js";
import { runAiTask } from "../ai/run.js";

const MAX_FACTS = 30;
const MAX_FACT_LENGTH = 300;
const BULLET = /^\s*(?:[-*•–]|\d+[.)])\s*/;

// Caregiver notes -> observed facts: one per line. A single paragraph is
// split into sentences so the model can cite each fact by index.
export function notesToFacts(body) {
  const lines = String(body ?? "").split(/\r?\n/).map(line => line.replace(BULLET, "").trim()).filter(Boolean);
  const facts = lines.length > 1 ? lines : lines.flatMap(line => line.split(/(?<=[.!?;])\s+/));
  return facts.map(fact => fact.trim()).filter(Boolean).map(fact => fact.slice(0, MAX_FACT_LENGTH)).slice(0, MAX_FACTS);
}

// Contract input from the stored activity. Meal and sleep activities need
// their structured details (saved with the activity, see activities.js).
export function draftInput(activity, details = {}) {
  const facts = notesToFacts(activity.body);
  if (!facts.length) throw new ApiError(400, "invalid_activity_notes", "Tulis minimal satu catatan pengamatan sebelum membuat draf AI.");
  const meal = activity.activity_type === "meal" ? details?.meal ?? null : null;
  const sleep = activity.activity_type === "sleep" ? details?.sleep ?? null : null;
  if (activity.activity_type === "meal" && !meal) {
    throw new ApiError(400, "activity_details_required", "Isi menu, porsi yang dimakan, dan kondisi saat makan, simpan draf, lalu coba lagi.");
  }
  if (activity.activity_type === "sleep" && !sleep) {
    throw new ApiError(400, "activity_details_required", "Isi jam mulai tidur (dan jam bangun bila sudah), simpan draf, lalu coba lagi.");
  }
  return {
    activity_id: activity.id,
    input_version: activity.version,
    activity_type: activity.activity_type,
    occurred_at: new Date(activity.occurred_at).toISOString(),
    timezone: "Asia/Jakarta",
    observed_facts: facts,
    meal,
    sleep,
  };
}

async function loadDraft(context, enrollmentId, activityId) {
  const activities = await rpc(context, "app_list_daily_activities", { p_enrollment_id: enrollmentId });
  const activity = (Array.isArray(activities) ? activities : []).find(item => item.id === activityId);
  // Managers and parents only see sent activities, so a draft found here is
  // the caller's own, written while they are the assigned caregiver.
  if (!activity) throw new ApiError(404, "activity_not_owned", "Catatan aktivitas tidak ditemukan.");
  if (activity.status !== "draft") throw new ApiError(409, "sent_activity_is_immutable", "Draf AI hanya untuk catatan yang belum dikirim.");
  const { data } = await context.supabase.from("daily_report_activities").select("details").eq("id", activityId).maybeSingle();
  return { activity, details: data?.details ?? {} };
}

// Stores the job. Returns its id, or null while the migration is missing.
async function recordJob(context, job) {
  const result = await context.supabase.rpc("app_record_logbook_draft_job", job);
  if (result.error?.code === "PGRST202") {
    console.warn("[ai] app_record_logbook_draft_job belum ada; jalankan migrasi 20261117100000. Draf tidak dicatat di ai_jobs.");
    return null;
  }
  return databaseData(result);
}

export async function draftActivity(context, enrollmentId, activityId, { provider, run = runAiTask } = {}) {
  uuid(enrollmentId, "enrollment_id", "ID pengajuan");
  uuid(activityId, "activity_id", "ID catatan");
  const limit = takeToken(`ai:logbook:${context.user.id}`, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) throw new ApiError(429, "RATE_LIMITED", `Batas 10 draf AI per menit. Coba lagi dalam ${limit.retryAfterSeconds} detik.`);

  const { activity, details } = await loadDraft(context, enrollmentId, activityId);
  const input = draftInput(activity, details);
  const spec = FEATURES.logbook_draft;
  const startedAt = new Date().toISOString();
  const job = {
    p_activity_id: activityId, p_input_version: activity.version, p_prompt_version: spec.promptVersion,
    p_input_snapshot: input, p_started_at: startedAt, p_idempotency_key: `logbook_draft:${activityId}:${crypto.randomUUID()}`,
  };

  let envelope;
  try {
    envelope = await run({ feature: "logbook_draft", input, provider: provider ?? getProvider("logbook_draft") });
  } catch (error) {
    const aiError = error instanceof AiError ? error : new AiError("PROVIDER_UNAVAILABLE");
    await recordJob(context, {
      ...job, p_provider: provider?.id ?? process.env.AI_PROVIDER ?? "not_configured", p_model: process.env.AI_TEXT_MODEL || "not_configured",
      p_model_version: null, p_output: null, p_status: "failed", p_error_code: aiError.code, p_attempt_number: aiError.attempt ?? 1,
    }).catch(failure => console.error(`[ai] gagal mencatat job logbook_draft: ${failure.message}`));
    throw new ApiError(aiError.status, aiError.code, aiError.message);
  }

  const jobId = await recordJob(context, {
    ...job, p_provider: envelope.meta.provider ?? provider?.id ?? "unknown", p_model: envelope.meta.model ?? "unknown",
    p_model_version: envelope.meta.model_version ?? null, p_output: envelope.result, p_status: "succeeded",
    p_error_code: null, p_attempt_number: envelope.attempt_number,
  });
  return { ...envelope, job_id: jobId, activity: { id: activity.id, version: activity.version } };
}
