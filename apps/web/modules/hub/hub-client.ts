import "server-only";
import FormbricksHub from "@formbricks/hub";
import { env } from "@/lib/env";

const globalForHub = globalThis as unknown as {
  formbricksHubClient: FormbricksHub | undefined;
};

/**
 * Returns a shared Formbricks Hub API client when HUB_API_KEY is set.
 * Uses a global singleton so the same instance is reused across the process
 * (and across Next.js HMR in development). When the key is not set, returns
 * null and does not cache that result so a later call with the key set
 * can create the client.
 */
export const getHubClient = (): FormbricksHub | null => {
  if (globalForHub.formbricksHubClient) {
    return globalForHub.formbricksHubClient;
  }
  const apiKey = env.HUB_API_KEY;
  if (!apiKey) return null;
  const client = new FormbricksHub({ apiKey, baseURL: env.HUB_API_URL });
  globalForHub.formbricksHubClient = client;
  return client;
};
