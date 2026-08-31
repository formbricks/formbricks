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

/** Hub's status for "this record already exists". See `lib/feedback-source/reconcile.ts`. */
const CONFLICT_STATUS = 409;

/**
 * The collection path `feedbackRecords.create` posts to.
 *
 * Matched with `endsWith` so a `baseURL` carrying a path prefix still resolves. Deliberately exact:
 * `/v1/feedback-records/{id}` and `/v1/feedback-records/count` must not match.
 */
const FEEDBACK_RECORDS_COLLECTION_PATH = "/v1/feedback-records";

type TShouldRetry = (response: Response) => Promise<boolean>;

const withShouldRetry = (target: object): { shouldRetry?: TShouldRetry } =>
  target as { shouldRetry?: TShouldRetry };

/**
 * A 409 from Hub's feedback-record create, which is terminal rather than a lock timeout.
 *
 * Three operations share this exact path: `create` (POST), `list` (GET) and the delete-by-user
 * bulk delete (DELETE), whose 409 *is* retryable — it means a tenant purge is running. A `Response`
 * does not carry the request method, so the path is all there is to go on. That is still safe here:
 * a GET cannot conflict, and the bulk delete is never issued through this client (the only caller,
 * `feedback-records-proxy.ts`, forwards with raw `fetch`, so the SDK's retry policy never applies
 * to it). If that changes, this needs a narrower discriminator than the path.
 */
const isTerminalConflict = (response: Response): boolean => {
  if (response.status !== CONFLICT_STATUS) return false;

  try {
    return new URL(response.url).pathname.endsWith(FEEDBACK_RECORDS_COLLECTION_PATH);
  } catch {
    // No usable URL is not evidence the conflict is terminal — leave the SDK's own decision alone.
    return false;
  }
};

/**
 * Stop the SDK retrying a create that came back 409.
 *
 * `shouldRetry` returns `true` for 409 ("retry on lock timeouts") and `maxRetries` defaults to 2,
 * so every conflicting create costs three POSTs and ~1.5s of backoff before the 409 it was always
 * going to get. On a first import nothing conflicts and this is free. On a re-import *everything*
 * conflicts — that is the whole shape of the operation (`reconcile.ts`) — so it is 3x the requests
 * and ~100x the wall clock, all of it sleeping, inside a synchronous server action. Measured on a
 * stub Hub: 60 records went from 60 POSTs/29ms to 180 POSTs/2963ms.
 *
 * Done here rather than with a per-request `maxRetries: 0` so genuine 429 and 5xx retries survive
 * on the highest-volume write path in the app; scoped to the create so the retryable
 * `tenant_write_conflict` 409s on taxonomy, tenant and settings writes keep theirs.
 *
 * `shouldRetry` is `private` in the SDK's types — TypeScript forbids redeclaring it in a subclass,
 * unlike the `protected` `stringifyQuery` above — so the override is installed on the prototype.
 * Only when the base method is actually there: if a future SDK renames it, the SDK stops calling
 * ours too and the behaviour degrades to today's extra retries rather than to a broken client.
 */
const baseShouldRetry = withShouldRetry(FormbricksHub.prototype).shouldRetry;

if (typeof baseShouldRetry === "function") {
  withShouldRetry(FormbricksHubWithRepeatedArrayParams.prototype).shouldRetry = async function (
    this: FormbricksHub,
    response: Response
  ): Promise<boolean> {
    if (isTerminalConflict(response)) return false;

    return baseShouldRetry.call(this, response);
  };
}

let repeatedArrayParamsVerified = false;

/**
 * Guards the one failure mode the type system cannot see: if a future SDK release stops routing query
 * serialization through `stringifyQuery`, our override becomes an unused method — legal TypeScript,
 * silently back to comma-joining, and filters quietly stop matching. `buildURL` is public, so proving the
 * hook still fires costs one call.
 *
 * Deliberately **not** run from `getHubClient()`. It used to be, which meant every one of `service.ts`'s
 * ~20 Hub consumers — taxonomy, semantic search, create/update/delete, not just the two that send array
 * filters — paid for a probe they don't need, and a real SDK regression would fail client *construction*
 * itself: the throw happens before the `globalThis` cache assignment, so it re-probes and re-throws on
 * every single Hub call, turning a narrow serialization regression into a total Hub outage. It also sat
 * outside every caller's own `try`, so it depended on the outer API wrapper to turn it into a controlled
 * response rather than an uncaught exception.
 *
 * Called instead from the two operations that actually depend on array serialization
 * (`listFeedbackRecords`, `countFeedbackRecords`), inside their existing `try` — so a failure becomes the
 * same relayed Hub error every other failure on those paths produces, and every other Hub consumer is
 * unaffected. Memoized because the property can't change within a process once true.
 */
export const assertRepeatedArrayParams = (client: FormbricksHub): void => {
  if (repeatedArrayParamsVerified) return;

  const probe = new URL(client.buildURL("/probe", { p: ["a", "b"] }));
  const values = probe.searchParams.getAll("p");

  if (values.length !== 2 || values[0] !== "a" || values[1] !== "b") {
    throw new Error(
      "@formbricks/hub no longer routes query serialization through stringifyQuery, so array filters " +
        `would be sent comma-joined and silently match nothing (probe produced "${probe.search}"). ` +
        "See modules/hub/hub-query.ts."
    );
  }

  repeatedArrayParamsVerified = true;
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
  globalForHub.formbricksHubClientRepeatArrays = client;
  return client;
};
