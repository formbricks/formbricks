import { parseV3ApiError } from "@/modules/api/lib/v3-client";

/**
 * The one way the Creatives screens call `/api/v3/creatives` from the browser: every list, editor,
 * summary and survey-side call goes through `requestCreativesApi`, so paths are encoded, caching is off,
 * writes can't hang and a refusal arrives as the parsed `V3ApiError` everywhere.
 */

// Bounds a stalled write so its pending state can't hang; the rejection shows the error toast.
const MUTATION_TIMEOUT_MS = 15_000;

export type TCreativesApiRequest = Readonly<{
  /** Path segments below `/api/v3/creatives` (a creative id, then an action such as `archive`). */
  path?: readonly string[];
  query?: URLSearchParams;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Sent as JSON. */
  body?: unknown;
  /** A read passes its query's signal; a write without one times out. */
  signal?: AbortSignal;
}>;

export const requestCreativesApi = async ({
  path = [],
  query,
  method = "GET",
  body,
  signal,
}: TCreativesApiRequest): Promise<Response> => {
  const segments = path.map((segment) => `/${encodeURIComponent(segment)}`).join("");
  const queryString = query?.toString();
  const search = queryString ? `?${queryString}` : "";
  const response = await fetch(`/api/v3/creatives${segments}${search}`, {
    method,
    cache: "no-store",
    ...(body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    signal: signal ?? (method === "GET" ? undefined : AbortSignal.timeout(MUTATION_TIMEOUT_MS)),
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return response;
};

/** The `data` of a v3 success body. */
export const readCreativesApiData = async <T>(response: Response): Promise<T> =>
  ((await response.json()) as { data: T }).data;
