import "server-only";
import FormbricksHub from "@formbricks/hub";
import { env } from "@/lib/env";
import { serializeHubQuery } from "./hub-query";

/**
 * The Hub client, with array query params serialized as repeated parameters.
 *
 * The generated SDK comma-joins them, which the Hub does not split — see `hub-query.ts` for the full
 * reasoning. `stringifyQuery` is `protected` in the SDK's types but an ordinary prototype method at
 * runtime, so a subclass is the whole fix, and it keeps every generated resource method (and its response
 * types) intact rather than hand-building requests.
 */
class FormbricksHubWithRepeatedArrayParams extends FormbricksHub {
  protected override stringifyQuery(query: object | Record<string, unknown>): string {
    return serializeHubQuery(query);
  }
}

/**
 * Guards the one failure mode the type system cannot see: if a future SDK release stops routing query
 * serialization through `stringifyQuery`, our override becomes an unused method — legal TypeScript,
 * silently back to comma-joining, and filters quietly stop matching. `buildURL` is public, so proving the
 * hook still fires costs one call at construction.
 */
const assertRepeatedArrayParams = (client: FormbricksHub): void => {
  const probe = new URL(client.buildURL("/probe", { p: ["a", "b"] }));
  const values = probe.searchParams.getAll("p");

  if (values.length !== 2 || values[0] !== "a" || values[1] !== "b") {
    throw new Error(
      "@formbricks/hub no longer routes query serialization through stringifyQuery, so array filters " +
        `would be sent comma-joined and silently match nothing (probe produced "${probe.search}"). ` +
        "See modules/hub/hub-query.ts."
    );
  }
};

// Renamed from `formbricksHubClient` when the override landed: globalThis survives Next's HMR, so the old
// key could hand back a client built from the pre-override class and comma-join in dev while every test
// passed.
const globalForHub = globalThis as unknown as {
  formbricksHubClientRepeatArrays: FormbricksHub | undefined;
};

/**
 * Returns a shared Formbricks Hub API client when HUB_API_KEY is set.
 * Uses a global singleton so the same instance is reused across the process
 * (and across Next.js HMR in development). When the key is not set, returns
 * null and does not cache that result so a later call with the key set
 * can create the client.
 */
export const getHubClient = (): FormbricksHub | null => {
  if (globalForHub.formbricksHubClientRepeatArrays) {
    return globalForHub.formbricksHubClientRepeatArrays;
  }
  const apiKey = env.HUB_API_KEY;
  if (!apiKey) return null;
  const client = new FormbricksHubWithRepeatedArrayParams({ apiKey, baseURL: env.HUB_API_URL });
  assertRepeatedArrayParams(client);
  globalForHub.formbricksHubClientRepeatArrays = client;
  return client;
};
