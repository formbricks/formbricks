/**
 * The transport under the Hub client: per-attempt timeout plus the retry policy.
 *
 * The Stainless-generated SDK (≤ 0.13) carried both inside its request loop — `maxRetries` 2 with
 * exponential backoff on connection failures, 408, 409, 429 and 5xx, and a 60s timeout per attempt. The
 * Hey API client (0.14+) has neither: its `fetch` is a bare `globalThis.fetch`, which retries nothing and
 * waits forever. This restores that policy as a custom `fetch`, handed to the client through
 * `createConfig({ fetch })` in `hub-client.ts`, so every generated operation goes through it.
 *
 * Deliberately free of `server-only`, `env` and any SDK import, so it can be unit-tested on its own.
 */

/** Retries after the first attempt. Matches the Stainless default, so three attempts at most. */
const MAX_RETRIES = 2;

/** Per attempt, not per call: a retry gets a fresh budget. Matches the Stainless default. */
export const DEFAULT_TIMEOUT_MS = 60_000;

const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 8_000;

/**
 * The longest server-requested wait we will sit through before a retry.
 *
 * A `Retry-After` above this is taken as "not within this request's lifetime": the response is returned
 * as-is instead of retried early, which would be a request the server has already said it will refuse.
 * Stainless slept for whatever it was told, which inside a synchronous server action is a hung request.
 */
const MAX_RETRY_AFTER_MS = 60_000;

/** Hub's status for a conflict. Two unrelated conditions share it — see `isTerminalConflict`. */
const CONFLICT_STATUS = 409;

/**
 * The collection path the feedback-record create posts to.
 *
 * Matched with `endsWith` so a base URL carrying a path prefix still resolves. Deliberately exact:
 * `/v1/feedback-records/{id}` and `/v1/feedback-records/count` must not match.
 */
const FEEDBACK_RECORDS_COLLECTION_PATH = "/v1/feedback-records";

/**
 * Hub's RFC 9457 problem code for a duplicate (tenant_id, submission_id, field_id).
 *
 * The code, not the status, is what tells the two 409s apart. Hub draws the same line in its own error
 * types: `ConflictError` (`code: "conflict"`) is terminal, and `TenantWriteConflictError`
 * (`code: "tenant_write_conflict"`) is "deliberately distinct ... so retryable lock conflicts are never
 * confused with terminal resource conflicts".
 */
const DUPLICATE_RECORD_CODE = "conflict";

/**
 * Reads the `code` member of Hub's problem body, or undefined when there isn't a usable one.
 *
 * Reads a **clone**: a body can only be consumed once, and the client reads the original if this
 * response is the one returned.
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
 * A 409 from Hub's feedback-record create that is the duplicate row rather than a write-lock refusal.
 *
 * The create answers 409 for two unrelated reasons, so the status alone cannot decide:
 *
 * - `conflict` — the unique index rejected (tenant_id, submission_id, field_id). Terminal, and the whole
 *   shape of a re-import.
 * - `tenant_write_conflict` — the insert's tenant write lock was refused because a tenant data purge is
 *   draining for that tenant. Hub's `openapi.yaml` documents it on this very operation ("retryable –
 *   retry after the purge completes"), and its repository raises it beside the duplicate
 *   (`internal/repository/feedback_records_repository.go`, `Create`). Suppressing that retry would turn
 *   a transient purge into a failed record, so the code is read and only the duplicate is terminal.
 *
 * Scoped to `POST` on the collection path: it keeps the narrowing on the one operation whose cost was
 * measured, and `conflict` is also raised by taxonomy runs. The same path also serves the list (GET)
 * and the delete-by-user bulk delete (DELETE); the request's method rules both out directly.
 */
const isTerminalConflict = async (request: Request, response: Response): Promise<boolean> => {
  if (response.status !== CONFLICT_STATUS || request.method !== "POST") return false;
  if (!new URL(request.url).pathname.endsWith(FEEDBACK_RECORDS_COLLECTION_PATH)) return false;

  return (await readProblemCode(response)) === DUPLICATE_RECORD_CODE;
};

/**
 * Whether a failed response is worth another attempt. Stainless's policy, plus one narrowing.
 *
 * The narrowing: a create that came back a duplicate 409 is never retried. On a first import nothing
 * conflicts and this is free. On a re-import *everything* conflicts — that is the whole shape of the
 * operation (`reconcile.ts`) — so retrying it is 3x the requests and ~100x the wall clock, all of it
 * sleeping, inside a synchronous server action. Measured on a stub Hub: 60 records went from 60
 * POSTs/29ms to 180 POSTs/2963ms. Keyed on the duplicate's problem code so genuine 429/5xx retries and
 * every retryable `tenant_write_conflict` survive on the highest-volume write path in the app.
 */
const shouldRetry = async (request: Request, response: Response): Promise<boolean> => {
  if (await isTerminalConflict(request, response)) return false;

  // Not a standard header, but if the server says whether to retry, obey.
  const shouldRetryHeader = response.headers.get("x-should-retry");
  if (shouldRetryHeader === "true") return true;
  if (shouldRetryHeader === "false") return false;

  // 408 request timeout, 409 lock conflict (`tenant_write_conflict`), 429 rate limit, 5xx.
  return (
    response.status === 408 ||
    response.status === CONFLICT_STATUS ||
    response.status === 429 ||
    response.status >= 500
  );
};

/**
 * The wait the server asked for, in ms, or undefined when it did not ask (or asked unintelligibly).
 *
 * `retry-after-ms` is non-standard but precise, so it wins. `Retry-After` is either delay-seconds or an
 * HTTP-date (RFC 9110 §10.2.3); a date already in the past means "now".
 */
const readRetryAfterMs = (headers: Headers): number | undefined => {
  const millis = Number.parseFloat(headers.get("retry-after-ms") ?? "");
  if (Number.isFinite(millis) && millis >= 0) return millis;

  const retryAfter = headers.get("retry-after");
  if (!retryAfter) return undefined;

  const seconds = Number.parseFloat(retryAfter);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : undefined;

  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
};

/** Exponential backoff with up to 25% jitter: ~0.5s, ~1s, … capped at 8s. Stainless's curve. */
const backoffMs = (retryIndex: number): number =>
  Math.min(INITIAL_RETRY_DELAY_MS * 2 ** retryIndex, MAX_RETRY_DELAY_MS) * (1 - Math.random() * 0.25);

/** Resolves after `ms`, or rejects with the signal's reason as soon as the caller aborts. */
const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal.addEventListener("abort", onAbort, { once: true });
  });

export type THubFetchOptions = {
  /** Per-attempt timeout. Only overridden by tests. */
  timeoutMs?: number;
};

/**
 * A `fetch` that times out each attempt and retries the transient failures.
 *
 * - **Connection failures and timeouts** are retried; a caller's own abort never is.
 * - **Failed responses** are retried per `shouldRetry`, after the server's `Retry-After` when it gives
 *   one (up to `MAX_RETRY_AFTER_MS`), otherwise after `backoffMs`. The response that exhausts the
 *   retries is returned untouched, so the client parses and reports it like any other error.
 * - **The timeout** bounds headers *and* body, since the per-attempt signal stays attached to the
 *   returned response.
 *
 * Resolves `globalThis.fetch` per call rather than capturing it, so a test's `vi.stubGlobal("fetch")`
 * reaches it.
 */
export const createHubFetch = ({ timeoutMs = DEFAULT_TIMEOUT_MS }: THubFetchOptions = {}): typeof fetch => {
  return async (input, init) => {
    // The generated client always hands over a fully-built Request; normalizing keeps this a real
    // `fetch` for any other caller. Kept unconsumed as the template every attempt is cloned from.
    const request = new Request(input, init);

    for (let retryIndex = 0; ; retryIndex++) {
      const retriesRemaining = MAX_RETRIES - retryIndex;
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]);

      let response: Response;

      try {
        response = await globalThis.fetch(new Request(request.clone(), { signal }));
      } catch (error) {
        // The caller gave up: retrying would be a request nobody is waiting for.
        if (request.signal.aborted || retriesRemaining === 0) throw error;

        await sleep(backoffMs(retryIndex), request.signal);
        continue;
      }

      if (response.ok || retriesRemaining === 0 || !(await shouldRetry(request, response))) {
        return response;
      }

      const retryAfterMs = readRetryAfterMs(response.headers);

      if (retryAfterMs !== undefined && retryAfterMs > MAX_RETRY_AFTER_MS) return response;

      // Not needed, and an unread body pins the connection until it is garbage-collected. Not awaited:
      // on a body that was cloned (`readProblemCode`), cancelling one branch only settles once every
      // branch is done, which is nothing this retry should wait on.
      response.body?.cancel().catch(() => undefined);
      await sleep(retryAfterMs ?? backoffMs(retryIndex), request.signal);
    }
  };
};
