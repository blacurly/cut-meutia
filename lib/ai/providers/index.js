// Chooses the processor for a feature. Language features use AI_PROVIDER
// ("openai-compatible" or "fixture"). Vision features cannot run on a text
// model alone: legal_verification reads the file with the OCR service first
// (lib/ai/ocr-client.js) and then uses getTextProvider() on the OCR text
// (lib/api/legal-read.js); face masking uses the CV service. Incident triage
// always goes to the triage service (TRIAGE_API_URL), never to a general
// language model.
import { AiError } from "../errors.js";
import { FEATURES } from "../features.js";
import { fixtureProvider } from "./fixture.js";
import { createOpenAiCompatibleProvider } from "./openai-compatible.js";
import { createTriageApiProvider, triageConfigured } from "./triage-api.js";

const PROVIDERS = { fixture: fixtureProvider, "openai-compatible": createOpenAiCompatibleProvider() };

export function providerName(env = process.env) {
  return env.AI_PROVIDER || (env.NODE_ENV === "production" ? null : "fixture");
}

// The language model regardless of feature kind, for pipelines that turn an
// image or document into text first.
export function getTextProvider(env = process.env) {
  const name = providerName(env);
  if (!name || !Object.hasOwn(PROVIDERS, name)) throw new AiError("MODEL_UNAVAILABLE", "AI_PROVIDER belum diatur.");
  return PROVIDERS[name];
}

export function getProvider(feature, env = process.env) {
  if (feature === "incident_triage") {
    if (triageConfigured(env)) return createTriageApiProvider({ env });
    if (providerName(env) === "fixture") return fixtureProvider;
    throw new AiError("MODEL_UNAVAILABLE", "TRIAGE_API_URL atau TRIAGE_API_TOKEN belum diatur.");
  }
  const name = providerName(env);
  if (!name || !Object.hasOwn(PROVIDERS, name)) throw new AiError("MODEL_UNAVAILABLE", "AI_PROVIDER belum diatur.");
  if (FEATURES[feature].kind === "vision" && name !== "fixture") {
    throw new AiError("MODEL_UNAVAILABLE", "Pemroses gambar/dokumen untuk fitur ini belum dipasang.");
  }
  return PROVIDERS[name];
}
