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
  /** The machine-readable half of a problem a client has to act on, e.g. what a conflict collided with. */
  details?: Record<string, unknown>;

  constructor({
    status,
    detail,
    code,
    requestId,
    invalid_params,
    details,
  }: {
    status: number;
    detail: string;
    code?: string;
    requestId?: string;
    invalid_params?: TV3InvalidParam[];
    details?: Record<string, unknown>;
  }) {
    super(detail);
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
    details: problemBody?.details,
  });
}
