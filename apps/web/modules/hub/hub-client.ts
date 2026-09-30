import "server-only";
import { type Client, createClient, createConfig } from "@formbricks/hub";
import { env } from "@/lib/env";
import { createHubFetch } from "./hub-fetch";
import { HubApiError } from "./utils";

/**
 * Turns the client's error value back into an `Error` carrying the HTTP status.
 *
 * For a non-2xx response the generated client hands over the *parsed body* (or its raw text) and nothing
 * else — no status. Wrapped here, once, so no call site has to reassemble it from `response`.
 *
 * Everything without a response — a connection failure, a timeout, a caller abort — is already an
 * `Error` from `fetch` and passes through untouched, so `getHubErrorHint` can still walk its cause chain.
 * So does a 2xx that failed to parse: it has a status, but the status is not what went wrong.
 */
const toHubApiError = (error: unknown, response: Response | undefined): unknown =>
  response && !response.ok
    ? new HubApiError(response.status, error === "" ? undefined : error, response.headers)
    : error;

const buildHubClient = (apiKey: string, baseUrl: string): Client => {
  const client = createClient(
    createConfig({
      baseUrl,
      auth: () => apiKey,
      // Retries and a per-attempt timeout; the generated client has neither. See `hub-fetch.ts`.
      fetch: createHubFetch(),
      // A runtime default so a call that forgets `throwOnError` still cannot mistake a failure for an
      // empty success. Call sites pass it too: only the per-call flag narrows `data` in the types.
      throwOnError: true,
    })
  );

  client.interceptors.error.use(toHubApiError);

  return client;
};

// Renamed with each change of client shape: globalThis survives Next's HMR, so a stale key would hand back
// a client built by the previous code — here, a Stainless instance with none of the functions below.
const globalForHub = globalThis as unknown as {
  formbricksHubHeyApiClient: Client | undefined;
};

/**
 * Returns a shared Formbricks Hub API client when HUB_API_KEY is set.
 * Uses a global singleton so the same instance is reused across the process
 * (and across Next.js HMR in development). When the key is not set, returns
 * null and does not cache that result so a later call with the key set
 * can create the client.
 */
export const getHubClient = (): Client | null => {
  if (globalForHub.formbricksHubHeyApiClient) {
    return globalForHub.formbricksHubHeyApiClient;
  }
  const apiKey = env.HUB_API_KEY;
  if (!apiKey) return null;
  const client = buildHubClient(apiKey, env.HUB_API_URL);
  globalForHub.formbricksHubHeyApiClient = client;
  return client;
};
