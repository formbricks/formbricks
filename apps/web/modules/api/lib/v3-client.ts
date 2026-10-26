export type TV3InvalidParam = {
  name: string;
  reason: string;
  /** What kind of problem, from v3's `InvalidParam.code`, when the operation sets one. */
  code?: string;
  /** The thing the problem is about, e.g. the import limit a file is past. */
  identifier?: string;
};

type TV3ProblemBody = {
  status?: number;
  detail?: string;
  code?: string;
  requestId?: string;
  invalid_params?: TV3InvalidParam[];
  details?: Record<string, unknown>;
};

export class V3ApiError extends Error {
  status: number;
  code?: string;
  requestId?: string;
  invalid_params?: TV3InvalidParam[];
  /** The machine-readable half of a problem, e.g. the current `updatedAt` of a stale write. */
  details?: Record<string, unknown>;
  /** Seconds to wait before asking again, from a 429's `Retry-After`. */
  retryAfter?: number;

  constructor({
    status,
    detail,
    code,
    requestId,
    invalid_params,
    details,
    retryAfter,
  }: {
    status: number;
    detail: string;
    code?: string;
    requestId?: string;
    invalid_params?: TV3InvalidParam[];
    details?: Record<string, unknown>;
    retryAfter?: number;
  }) {
    super(detail);
    this.name = "V3ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.invalid_params = invalid_params;
    this.details = details;
    this.retryAfter = retryAfter;
  }

  get detail(): string {
    return this.message;
  }
}

/** A 429 asking for a wait this short is a busy moment, worth waiting out; a longer one is a spent budget. */
const MAX_WAITED_RETRY_AFTER_SECONDS = 5;
/** How many such waits one read sits through before its error shows. */
const MAX_BUSY_RETRIES = 5;

/** A 429 that asks for a short wait, such as every in-flight chart query slot being taken. */
const isBriefBusy = (error: unknown): error is V3ApiError =>
  error instanceof V3ApiError &&
  error.status === 429 &&
  error.retryAfter !== undefined &&
  error.retryAfter <= MAX_WAITED_RETRY_AFTER_SECONDS;

/**
 * A TanStack Query `retry` policy for v3 reads: a 4xx is the server's answer, and asking again only
 * delays it — a dashboard the caller may not open spun for seconds through three retries before its
 * error showed, and every retry spent the caller's rate limit. Network failures and 5xx are retried up
 * to `maxRetries` times. The one 4xx retried is a 429 asking for a short wait (`Retry-After` of a few
 * seconds), so a large dashboard waits for a free chart query slot instead of showing errors.
 */
export const retryUnlessClientError =
  (maxRetries: number) =>
  (failureCount: number, error: unknown): boolean => {
    if (isBriefBusy(error)) return failureCount < MAX_BUSY_RETRIES;
    return (
      failureCount < maxRetries && !(error instanceof V3ApiError && error.status >= 400 && error.status < 500)
    );
  };

/**
 * The `retryDelay` that goes with `retryUnlessClientError`: a 429's own `Retry-After`, with a little
 * jitter so a dashboard's widgets do not all come back at once; otherwise TanStack's default backoff.
 */
export const v3RetryDelay = (failureCount: number, error: unknown): number =>
  isBriefBusy(error)
    ? (error.retryAfter as number) * 1000 + Math.floor(Math.random() * 500)
    : Math.min(1000 * 2 ** failureCount, 30_000);

export function getV3ApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof V3ApiError) {
    return error.detail;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

export async function parseV3ApiError(response: Response): Promise<V3ApiError> {
  let problemBody: TV3ProblemBody | undefined;

  try {
    problemBody = (await response.json()) as TV3ProblemBody;
  } catch {
    problemBody = undefined;
  }

  return new V3ApiError({
    status: problemBody?.status ?? response.status,
    detail: problemBody?.detail ?? response.statusText ?? "An unexpected error occurred.",
    code: problemBody?.code,
    requestId: problemBody?.requestId ?? response.headers.get("X-Request-Id") ?? undefined,
    invalid_params: problemBody?.invalid_params,
    details:
      problemBody?.details && typeof problemBody.details === "object" && !Array.isArray(problemBody.details)
        ? problemBody.details
        : undefined,
    retryAfter: parseRetryAfterSeconds(response.headers.get("Retry-After")),
  });
}

/** `Retry-After` in its delay-seconds form; the HTTP-date form is not one v3 sends. */
const parseRetryAfterSeconds = (value: string | null): number | undefined => {
  if (value === null || !/^\d+$/.test(value.trim())) return undefined;
  return Number(value.trim());
};
