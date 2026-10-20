import { Agent } from "undici";
import { AI_MODEL_HTTP_TIMEOUT_MS } from "@formbricks/types/ai-timeout";

// Shared across providers and models: creating an agent per call would leak connection pools.
// The SDK's total timeout is still authoritative, including time spent retrying. These transport
// limits only keep Node's five-minute defaults from cutting a configured call short.
const modelDispatcher = new Agent({
  headersTimeout: AI_MODEL_HTTP_TIMEOUT_MS,
  bodyTimeout: AI_MODEL_HTTP_TIMEOUT_MS,
});

export const modelFetch: typeof fetch = (input, init) => {
  const modelInit: RequestInit & { dispatcher: Agent } = { ...init, dispatcher: modelDispatcher };
  return globalThis.fetch(input, modelInit);
};
