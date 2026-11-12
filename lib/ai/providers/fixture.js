// Development provider: answers with the contract's output example for the
// feature. It never calls a model, so results are clearly labelled
// provider "fixture" and must not be shown as real AI output in production.
import { featureContract } from "../features.js";

export const fixtureProvider = {
  id: "fixture",
  configured: () => true,
  async generate({ feature }) {
    return {
      output: structuredClone(featureContract(feature).output_example),
      meta: { provider: "fixture", model: "contract-v1-example", model_version: "not_reported", usage: null },
    };
  },
};
