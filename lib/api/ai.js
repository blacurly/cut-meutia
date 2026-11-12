// /api/ai/* — AI framework endpoints (contract v1, lib/ai).
//
// GET  /api/ai/features            public: the eight job types, their use
//                                  case, processor, roles and example input.
// POST /api/ai/sandbox/{feature}   Admin only: runs a task on a contract
//                                  input (synthetic data) and returns the
//                                  job envelope. Production endpoints will
//                                  take only source_id + version and read the
//                                  source from the database after checking
//                                  role/ownership (docs/keputusan-mvp 5.1).
import { ApiError, readObject } from "./http.js";
import { AiError } from "../ai/errors.js";
import { CONTRACT_VERSION, FEATURES, FEATURE_IDS, featureContract } from "../ai/features.js";
import { getProvider, providerName } from "../ai/providers/index.js";
import { takeToken } from "../ai/rate-limit.js";
import { runAiTask } from "../ai/run.js";

const MAX_INPUT_BYTES = 32 * 1024;

export function listFeatures() {
  const provider = providerName();
  return {
    contract_version: CONTRACT_VERSION,
    provider: provider ?? "not_configured",
    features: FEATURE_IDS.map(id => {
      const spec = FEATURES[id];
      const contract = featureContract(id);
      return {
        id, product: spec.product, use_case: spec.useCase, processor: spec.kind,
        roles: spec.roles, source_column: spec.sourceColumn, prompt_version: spec.promptVersion,
        trigger: contract.trigger,
        available: Boolean(provider) && (spec.kind !== "vision" || provider === "fixture"),
        example_input: contract.input_example,
      };
    }),
  };
}

async function requireAdmin({ supabase, user }) {
  const { data, error } = await supabase.from("users").select("role, status").eq("id", user.id).maybeSingle();
  if (error || data?.status !== "active" || data?.role !== "admin") {
    throw new ApiError(403, "admin_role_required", "Sandbox AI hanya untuk Admin.");
  }
}

export async function runSandbox(context, request, feature) {
  if (!Object.hasOwn(FEATURES, feature)) throw new ApiError(404, "ai_feature_not_found", "Fitur AI tidak dikenal.");
  await requireAdmin(context);
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_INPUT_BYTES) throw new ApiError(413, "input_too_large", "Input AI maksimal 32 KB.");
  const body = await readObject(request, ["input"]);
  if (JSON.stringify(body.input ?? null).length > MAX_INPUT_BYTES) throw new ApiError(413, "input_too_large", "Input AI maksimal 32 KB.");

  const limit = takeToken(`ai:${context.user.id}`, { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) throw new ApiError(429, "RATE_LIMITED", `Batas 10 permintaan AI per menit. Coba lagi dalam ${limit.retryAfterSeconds} detik.`);

  try {
    return await runAiTask({ feature, input: body.input, provider: getProvider(feature) });
  } catch (error) {
    if (error instanceof AiError) {
      throw new ApiError(error.status, error.code, error.detail ? `${error.message} ${error.detail}` : error.message);
    }
    throw error;
  }
}
