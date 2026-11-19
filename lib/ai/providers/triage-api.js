// Provider for "incident_triage": the triage service (separate repository
// ayomi-triage-api, deployed on Dokploy). It runs the IndoBERT model from
// docs/incident-triage-indobert.ipynb, or the rubric rules until that model
// passes its criteria; both answer with the contract v1 output, so the usual
// checks in lib/ai/run.js and FEATURES.incident_triage.check still apply.
// Server-only env vars: TRIAGE_API_URL and TRIAGE_API_TOKEN (never NEXT_PUBLIC_).
// Incident urgency is never sent to a general language model.
import { AiError, providerError } from "../errors.js";

const TIMEOUT_MS = 30_000;

export function triageConfigured(env = process.env) {
  return Boolean(env.TRIAGE_API_URL?.trim() && env.TRIAGE_API_TOKEN?.trim());
}

export function createTriageApiProvider({ env = process.env, fetchImpl = fetch } = {}) {
  return {
    id: "triage-api",
    configured: () => triageConfigured(env),
    async generate({ feature, input }) {
      if (feature !== "incident_triage") throw new AiError("MODEL_UNAVAILABLE", `Layanan triage tidak melayani ${feature}.`);
      const url = env.TRIAGE_API_URL?.trim().replace(/\/+$/, "");
      const token = env.TRIAGE_API_TOKEN?.trim();
      if (!url || !token) throw new AiError("MODEL_UNAVAILABLE", "TRIAGE_API_URL atau TRIAGE_API_TOKEN belum diatur.");
      let response;
      try {
        response = await fetchImpl(`${url}/triage`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        throw new AiError(error?.name === "TimeoutError" ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE");
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw providerError(response.status, `Triage HTTP ${response.status}`);
      if (!payload?.result || typeof payload.result !== "object") throw new AiError("OUTPUT_INVALID", "Jawaban layanan triage tidak sesuai format.");
      const meta = payload.meta ?? {};
      return {
        output: payload.result,
        meta: {
          provider: "triage-api",
          // "rules" until the IndoBERT model is installed; the model name otherwise.
          model: meta.engine === "model" ? (meta.base_model || "indobert") : "rubric-rules",
          model_version: meta.model_version ?? "not_reported",
          engine: meta.engine ?? null,
          rubric_version: meta.rubric_version ?? null,
          probabilities: meta.probabilities ?? null,
          matched_rules: meta.matched_rules ?? null,
          usage: null,
        },
      };
    },
  };
}
