import "server-only";
import { type Client, createHubClient } from "@formbricks/hub";
import { env } from "@/lib/env";
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

/**
 * The SDK's own client — retries, per-attempt timeout and auth all come from `createHubClient` — plus the
 * one thing it leaves to consumers: turning a failure into an `Error` with a status.
 *
 * The interceptor is added to the returned client rather than built into a `createConfig` of our own,
 * because the SDK's retries live in the `fetch` it configures; a config that replaced `fetch` would
 * silently drop them. Interceptors run outside that `fetch`, so this sees only the final response.
 */
const buildHubClient = (apiKey: string, baseUrl: string): Client => {
  const client = createHubClient({ apiKey, baseUrl });

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
