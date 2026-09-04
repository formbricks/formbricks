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

/** Hub's status for a conflict. Two unrelated conditions share it — see `isTerminalConflict`. */
const CONFLICT_STATUS = 409;

/**
 * The collection path `feedbackRecords.create` posts to.
 *
 * Matched with `endsWith` so a `baseURL` carrying a path prefix still resolves. Deliberately exact:
 * `/v1/feedback-records/{id}` and `/v1/feedback-records/count` must not match.
 */
const FEEDBACK_RECORDS_COLLECTION_PATH = "/v1/feedback-records";

/**
 * Hub's RFC 9457 problem code for a duplicate (tenant_id, submission_id, field_id).
 *
 * The code, not the status, is what tells the two 409s apart. Hub draws the same line in its own
 * error types: `ConflictError` (`code: "conflict"`) is terminal, and `TenantWriteConflictError`
 * (`code: "tenant_write_conflict"`) is "deliberately distinct ... so retryable lock conflicts are
 * never confused with terminal resource conflicts".
 */
const DUPLICATE_RECORD_CODE = "conflict";

type TShouldRetry = (response: Response) => Promise<boolean>;

const withShouldRetry = (target: object): { shouldRetry?: TShouldRetry } =>
  target as { shouldRetry?: TShouldRetry };

/**
 * Reads the `code` member of Hub's problem body, or undefined when there isn't a usable one.
 *
 * Reads a **clone**: a body can only be consumed once, and the SDK reads the original right after
 * this — `response.text()` to build the APIError, or `CancelReadableStream(response.body)` before
 * a retry.
 */
const readProblemCode = async (response: Response): Promise<string | undefined> => {
  try {
    const body: unknown = await response.clone().json();

    if (typeof body === "object" && body !== null) {
      const { code } = body as { code?: unknown };

      return typeof code === "string" ? code : undefined;
    }
  } catch {
    // A missing, truncated or non-JSON body says nothing about which 409 this is.
  }

  return undefined;
};

/**
 * A 409 from Hub's feedback-record create that is the duplicate row rather than a lock timeout.
 *
 * The create answers 409 for two unrelated reasons, so the status alone cannot decide:
 *
 * - `conflict` — the unique index rejected (tenant_id, submission_id, field_id). Terminal, and the
 *   whole shape of a re-import.
 * - `tenant_write_conflict` — the insert's tenant write lock was refused because a tenant data
 *   purge is draining for that tenant. Hub's `openapi.yaml` documents it on this very operation
 *   ("retryable – retry after the purge completes"), and its repository raises it beside the
 *   duplicate (`internal/repository/feedback_records_repository.go`, `Create`).
 *
 * Only the SDK's *docstrings* confine `tenant_write_conflict` to `tenants/*` and `taxonomy/*`,
 * which is what an earlier revision of this file read the enumeration off. Suppressing that retry
 * would turn a transient purge into a failed record, so the code is read and only the duplicate is
 * treated as terminal.
 *
 * The path stays as the outer scope: it keeps the narrowing on the one operation whose cost was
 * measured, and `conflict` is also raised by taxonomy runs. Three operations share this exact
 * path — `create` (POST), `list` (GET) and the delete-by-user bulk delete (DELETE) — and a
 * `Response` does not carry the request method, but neither of the other two can reach here with
 * this code: a GET cannot conflict, and the bulk delete's only 409 is `tenant_write_conflict`
 * (and it is never issued through this client — `feedback-records-proxy.ts` forwards it with raw
 * `fetch`, so the SDK's retry policy never applies to it).
 */
const isTerminalConflict = async (response: Response): Promise<boolean> => {
  if (response.status !== CONFLICT_STATUS) return false;

  let pathname: string;

  try {
    pathname = new URL(response.url).pathname;
  } catch {
    // No usable URL is not evidence the conflict is terminal — leave the SDK's own decision alone.
    return false;
  }

  if (!pathname.endsWith(FEEDBACK_RECORDS_COLLECTION_PATH)) return false;

  return (await readProblemCode(response)) === DUPLICATE_RECORD_CODE;
};

/**
 * Stop the SDK retrying a create that came back a duplicate 409.
 *
 * `shouldRetry` returns `true` for 409 ("retry on lock timeouts") and `maxRetries` defaults to 2,
 * so every conflicting create costs three POSTs and ~1.5s of backoff before the 409 it was always
 * going to get. On a first import nothing conflicts and this is free. On a re-import *everything*
 * conflicts — that is the whole shape of the operation (`reconcile.ts`) — so it is 3x the requests
 * and ~100x the wall clock, all of it sleeping, inside a synchronous server action. Measured on a
 * stub Hub: 60 records went from 60 POSTs/29ms to 180 POSTs/2963ms.
 *
 * Done here rather than with a per-request `maxRetries: 0` so genuine 429 and 5xx retries survive
 * on the highest-volume write path in the app; keyed on the duplicate's problem code so every
 * retryable `tenant_write_conflict` keeps its retries — the create's own included.
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
    if (await isTerminalConflict(response)) return false;

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
