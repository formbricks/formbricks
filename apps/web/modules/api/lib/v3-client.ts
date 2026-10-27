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
  details?: unknown;
};

export class V3ApiError extends Error {
  status: number;
  code?: string;
  requestId?: string;
  invalid_params?: TV3InvalidParam[];
  /** The problem's `details`, unparsed: their shape depends on `code`, so the caller reads them. */
  details?: unknown;

  constructor({
    status,
    detail,
    code,
    requestId,
    invalid_params,
    details,
    cause,
  }: {
    status: number;
    detail: string;
    code?: string;
    requestId?: string;
    invalid_params?: TV3InvalidParam[];
    details?: unknown;
    cause?: unknown;
  }) {
    super(detail, { cause });
    this.name = "V3ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.invalid_params = invalid_params;
    this.details = details;
  }

  get detail(): string {
    return this.message;
  }
}

export function getV3ApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof V3ApiError) {
    // A failure with nothing to say (no problem body, a network error) gets the caller's translated text.
    return error.detail || fallbackMessage;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

/**
 * The machine-readable reason a refused request carries in `details.reason` — a service's error code that
 * the page translates — falling back to the problem's message, then to the caller's translated fallback.
 */
export function getV3ApiErrorReason(error: unknown, fallbackMessage: string): string {
  if (error instanceof V3ApiError) {
    const { details } = error;
    const reason =
      typeof details === "object" && details !== null ? Reflect.get(details, "reason") : undefined;
    return typeof reason === "string" ? reason : error.detail || fallbackMessage;
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
    // `||`, not `??`: HTTP/2 has no reason phrase, so `statusText` is "" rather than missing.
    detail: problemBody?.detail || response.statusText || "",
    code: problemBody?.code,
    requestId: problemBody?.requestId ?? response.headers.get("X-Request-Id") ?? undefined,
    invalid_params: problemBody?.invalid_params,
    details: problemBody?.details,
  });
}
