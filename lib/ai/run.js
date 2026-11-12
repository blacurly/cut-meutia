// Runs one AI task end to end, independent of where it is called from
// (sandbox route now, job worker later):
//   validate input (contract) -> feature input rules -> provider call with
//   retry -> deterministic server checks -> validate output (contract).
// Returns the job-status envelope of contract v1 plus execution metadata.
// The result is a proposal: review_state "pending", application_state
// "not_applied". Applying it to domain tables is a separate, authorized step.
import { AiError } from "./errors.js";
import { CONTRACT_VERSION, FEATURES, featureContract } from "./features.js";
import { validate } from "./schema.js";

export const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [5_000, 20_000];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const describe = errors => errors.slice(0, 3).map(error => `${error.path} ${error.message}`).join("; ");

export async function runAiTask({ feature, input, provider, sleep = wait, random = Math.random }) {
  const spec = FEATURES[feature];
  if (!spec) throw new AiError("INPUT_INVALID", `Fitur AI tidak dikenal: ${feature}.`);
  const contract = featureContract(feature);
  const inputErrors = validate(contract.input_schema, input);
  if (inputErrors.length) throw new AiError("INPUT_INVALID", describe(inputErrors));
  spec.checkInput?.(input);

  const started = Date.now();
  let attempt = 0;
  let generated;
  for (;;) {
    attempt += 1;
    try {
      generated = await provider.generate({ feature, instructions: spec.instructions, input, outputSchema: contract.output_schema });
      break;
    } catch (error) {
      const aiError = error instanceof AiError ? error : new AiError("PROVIDER_UNAVAILABLE");
      if (!aiError.retryable || attempt >= MAX_ATTEMPTS) {
        aiError.attempt = attempt;
        throw aiError;
      }
      await sleep(RETRY_DELAYS_MS[attempt - 1] + Math.floor(random() * 3_000));
    }
  }

  let result;
  try {
    result = spec.check(input, generated.output);
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError("OUTPUT_INVALID", "Struktur hasil AI tidak lengkap.");
  }
  const outputErrors = validate(contract.output_schema, result);
  if (outputErrors.length) throw new AiError("OUTPUT_INVALID", describe(outputErrors));

  return {
    contract_version: CONTRACT_VERSION,
    feature,
    status: "succeeded",
    attempt_number: attempt,
    review_state: "pending",
    application_state: "not_applied",
    result,
    error: null,
    meta: {
      ...generated.meta,
      prompt_version: spec.promptVersion,
      latency_ms: Date.now() - started,
      ai_generated: true,
    },
  };
}
