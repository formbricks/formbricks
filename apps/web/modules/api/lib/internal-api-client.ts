import { V3ApiError, parseV3ApiError } from "@/modules/api/lib/v3-client";

/**
 * The fetch half of every dashboard API client: `/api/internal/*` and `/api/v3/*` speak the same
 * `{ data }` envelope and RFC 9457 problem+json, so the request/response handling lives here once and each
 * module's `api-client.ts` is reduced to paths and types.
 *
 * Reads forward TanStack's `signal`, so a superseded or unmounted query is cancelled. Writes get a timeout
 * instead: a mutation the user is waiting on should fail visibly rather than hang. A write that is meant to
 * run long (an import that walks every response) opts out with `timeoutMs: null`. Neither is cached by the
 * browser; the TanStack cache is the only cache.
 *
 * Every failure is a `V3ApiError`. One that never produced a problem response — the network, the timeout,
 * a body that isn't JSON — carries no `detail`, so `getV3ApiErrorMessage` shows the caller's translated
 * fallback rather than a browser's "Failed to fetch".
 */

export const API_MUTATION_TIMEOUT_MS = 15_000;

type TSearchParams = Record<string, string | number | boolean | null | undefined>;

/** A path plus its query string, skipping `null`/`undefined` values. */
export const buildApiUrl = (path: string, searchParams?: TSearchParams): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== null && value !== undefined) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

/** A failure with no problem response behind it: the request never got a usable answer. */
const transportError = (cause: unknown) =>
  new V3ApiError({ status: 0, detail: "", code: "network_error", cause });

/** One page of a list route: its items and the cursor to the next page. */
export type TApiListPage<T> = { data: T[]; meta: { limit: number; nextCursor: string | null } };

/** The response body, parsed: the whole `{ data, … }` envelope, or `undefined` for a 204. */
const readEnvelope = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw await parseV3ApiError(response);
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch (error) {
    // A 2xx that isn't our JSON, e.g. a proxy's or a challenge page's HTML.
    throw transportError(error);
  }
};

const request = async <T>(url: string, init: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    // A query cancelled by TanStack keeps its own error, which TanStack recognizes and ignores.
    if (init.signal?.aborted && init.signal.reason?.name === "AbortError") throw error;
    throw transportError(error);
  }
  return readEnvelope<T>(response);
};

const unwrap = <T>(envelope: { data: T } | undefined): T => envelope?.data as T;

/** `GET` a resource and unwrap its `{ data }` envelope. Throws a `V3ApiError` on any failure. */
export const getApiData = async <T>(url: string, { signal }: { signal?: AbortSignal } = {}): Promise<T> =>
  unwrap(await request<{ data: T }>(url, { method: "GET", cache: "no-store", signal }));

/** `GET` one page of a list route, keeping its `meta` (the next cursor) along with the items. */
export const getApiPage = <T>(
  url: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<TApiListPage<T>> => request<TApiListPage<T>>(url, { method: "GET", cache: "no-store", signal });

/**
 * Send a write and unwrap its `{ data }` envelope (`undefined` for a 204). Throws a `V3ApiError` on any
 * failure, which callers turn into a message with `getV3ApiErrorMessage`.
 */
export const sendApiRequest = async <T>(
  url: string,
  {
    method,
    body,
    timeoutMs = API_MUTATION_TIMEOUT_MS,
    signal,
  }: {
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    /** `null` for a write that is meant to run long; the server finishes it either way. */
    timeoutMs?: number | null;
    /** The caller's own abort (a query's cancellation, a Stop button), on top of the timeout. */
    signal?: AbortSignal;
  }
): Promise<T> => {
  const timeout = timeoutMs === null ? undefined : AbortSignal.timeout(timeoutMs);
  const combined = signal && timeout ? AbortSignal.any([signal, timeout]) : (signal ?? timeout);
  return unwrap(
    await request<{ data: T }>(url, {
      method,
      cache: "no-store",
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      ...(combined ? { signal: combined } : {}),
    })
  );
};
