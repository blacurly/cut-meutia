// Adapter for any OpenAI-compatible chat completions endpoint, e.g. the
// Hugging Face Inference router serving open-source pre-trained models
// (Technical Requirement: open source pre-trained model, run from Route
// Handlers, key only on the server). Configure with server-only env vars:
//   AI_BASE_URL    default https://router.huggingface.co/v1
//   AI_API_KEY     provider token (never NEXT_PUBLIC_)
//   AI_TEXT_MODEL  model id, e.g. an instruction-tuned open model
//   AI_JSON_MODE   "true" to send response_format json_object when supported
import { AiError, providerError } from "../errors.js";

const TIMEOUT_MS = 60_000;

function env() {
  return {
    baseUrl: (process.env.AI_BASE_URL || "https://router.huggingface.co/v1").replace(/\/+$/, ""),
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_TEXT_MODEL,
    jsonMode: process.env.AI_JSON_MODE === "true",
  };
}

// Models sometimes wrap JSON in ```json fences or add text around it.
export function parseJsonContent(content) {
  const text = String(content ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
    }
    throw new AiError("OUTPUT_INVALID", "Model tidak mengembalikan JSON.");
  }
}

export function createOpenAiCompatibleProvider({ fetchImpl = fetch } = {}) {
  return {
    id: "openai-compatible",
    configured: () => Boolean(env().apiKey && env().model),
    async generate({ instructions, input, outputSchema }) {
      const { baseUrl, apiKey, model, jsonMode } = env();
      if (!apiKey || !model) throw new AiError("MODEL_UNAVAILABLE", "AI_API_KEY atau AI_TEXT_MODEL belum diatur.");
      const started = Date.now();
      let response;
      try {
        response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          body: JSON.stringify({
            model,
            temperature: 0.2,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
            messages: [
              { role: "system", content: `${instructions}\nSkema JSON keluaran:\n${JSON.stringify(outputSchema)}` },
              { role: "user", content: JSON.stringify(input) },
            ],
          }),
        });
      } catch (error) {
        throw new AiError(error?.name === "TimeoutError" ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE");
      }
      if (!response.ok) throw providerError(response.status, `HTTP ${response.status}`);
      const data = await response.json().catch(() => null);
      const choice = data?.choices?.[0];
      if (choice?.finish_reason === "content_filter") throw new AiError("SAFETY_BLOCKED");
      return {
        output: parseJsonContent(choice?.message?.content),
        meta: {
          provider: "openai-compatible", model, model_version: data?.model || "not_reported",
          usage: data?.usage ? { input_tokens: data.usage.prompt_tokens ?? null, output_tokens: data.usage.completion_tokens ?? null } : null,
          provider_latency_ms: Date.now() - started,
        },
      };
    },
  };
}
