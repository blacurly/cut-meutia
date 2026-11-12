// Chooses the processor for a feature. Language features use AI_PROVIDER
// ("openai-compatible" or "fixture"). Vision features (OCR, face masking)
// need a dedicated detector/OCR service that is not built yet; until then
// they only run on the fixture provider outside production.
import { AiError } from "../errors.js";
import { FEATURES } from "../features.js";
import { fixtureProvider } from "./fixture.js";
import { createOpenAiCompatibleProvider } from "./openai-compatible.js";

const PROVIDERS = { fixture: fixtureProvider, "openai-compatible": createOpenAiCompatibleProvider() };

export function providerName(env = process.env) {
  return env.AI_PROVIDER || (env.NODE_ENV === "production" ? null : "fixture");
}

export function getProvider(feature, env = process.env) {
  const name = providerName(env);
  if (!name || !Object.hasOwn(PROVIDERS, name)) throw new AiError("MODEL_UNAVAILABLE", "AI_PROVIDER belum diatur.");
  if (FEATURES[feature].kind === "vision" && name !== "fixture") {
    throw new AiError("MODEL_UNAVAILABLE", "Pemroses gambar/dokumen untuk fitur ini belum dipasang.");
  }
  return PROVIDERS[name];
}
