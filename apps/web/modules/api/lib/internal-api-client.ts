import { parseV3ApiError } from "@/modules/api/lib/v3-client";

/**
 * The fetch half of every dashboard API client: `/api/internal/*` and `/api/v3/*` speak the same
 * `{ data }` envelope and RFC 9457 problem+json, so the request/response handling lives here once and each
 * module's `api-client.ts` is reduced to paths and types.
 *
 * Reads forward TanStack's `signal`, so a superseded or unmounted query is cancelled. Writes get a fixed
 * timeout instead: a mutation the user is waiting on should fail visibly rather than hang. Neither is
 * cached by the browser; the TanStack cache is the only cache.
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

const readData = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw await parseV3ApiError(response);
  if (response.status === 204) return undefined as T;
  return ((await response.json()) as { data: T }).data;
};

/** `GET` a resource and unwrap its `{ data }` envelope. Throws a `V3ApiError` on a problem response. */
export async function getApiData<T>(url: string, { signal }: { signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(url, { method: "GET", cache: "no-store", signal });
  return readData<T>(response);
}

/**
 * Send a write and unwrap its `{ data }` envelope (`undefined` for a 204). Throws a `V3ApiError` on a
 * problem response, which callers turn into a message with `getV3ApiErrorMessage`.
 */
export async function sendApiRequest<T>(
  url: string,
  { method, body }: { method: "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown }
): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(API_MUTATION_TIMEOUT_MS),
  });
  return readData<T>(response);
}
