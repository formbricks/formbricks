/**
 * V3 API response helpers — RFC 9457 Problem Details (application/problem+json)
 * and list envelope for success responses.
 */

const PROBLEM_JSON = "application/problem+json" as const;
const CACHE_NO_STORE = "private, no-store" as const;

export type InvalidParam = { name: string; reason: string };

export type ProblemExtension = {
  code?: string;
  requestId: string;
  details?: Record<string, unknown>;
  invalid_params?: InvalidParam[];
};

export type ProblemBody = {
  type?: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
} & ProblemExtension;

function problemResponse(
  status: number,
  title: string,
  detail: string,
  requestId: string,
  options?: {
    type?: string;
    instance?: string;
    code?: string;
    details?: Record<string, unknown>;
    invalid_params?: InvalidParam[];
    headers?: Record<string, string>;
  }
): Response {
  const body: ProblemBody = {
    title,
    status,
    detail,
    requestId,
    ...(options?.type && { type: options.type }),
    ...(options?.instance && { instance: options.instance }),
    ...(options?.code && { code: options.code }),
    ...(options?.details && { details: options.details }),
    ...(options?.invalid_params && { invalid_params: options.invalid_params }),
  };

  const headers: Record<string, string> = {
    "Content-Type": PROBLEM_JSON,
    "Cache-Control": CACHE_NO_STORE,
    "X-Request-Id": requestId,
    ...options?.headers,
  };

  return Response.json(body, { status, headers });
}

export function problemBadRequest(
  requestId: string,
  detail: string,
  options?: { invalid_params?: InvalidParam[]; instance?: string }
): Response {
  return problemResponse(400, "Bad Request", detail, requestId, {
    code: "bad_request",
    instance: options?.instance,
    invalid_params: options?.invalid_params,
  });
}

export function problemUnauthorized(
  requestId: string,
  detail: string = "Not authenticated",
  instance?: string
): Response {
  return problemResponse(401, "Unauthorized", detail, requestId, {
    code: "not_authenticated",
    instance,
  });
}

export function problemForbidden(
  requestId: string,
  detail: string = "You are not authorized to access this resource",
  instance?: string
): Response {
  return problemResponse(403, "Forbidden", detail, requestId, {
    code: "forbidden",
    instance,
  });
}

/**
 * 404 with resource details. Do not use for auth-sensitive or existence-sensitive resources:
 * the body includes resource_type and resource_id, which can leak existence to unauthenticated or unauthorized callers.
 * Prefer problemForbidden with a generic message for those cases.
 */
export function problemNotFound(
  requestId: string,
  resourceType: string,
  resourceId: string | null,
  instance?: string
): Response {
  return problemResponse(404, "Not Found", `${resourceType} not found`, requestId, {
    code: "not_found",
    details: { resource_type: resourceType, resource_id: resourceId },
    instance,
  });
}

export function problemInternalError(
  requestId: string,
  detail: string = "An unexpected error occurred.",
  instance?: string
): Response {
  return problemResponse(500, "Internal Server Error", detail, requestId, {
    code: "internal_server_error",
    instance,
  });
}

export function problemTooManyRequests(requestId: string, detail: string, retryAfter?: number): Response {
  const headers: Record<string, string> = {};
  if (retryAfter !== undefined) {
    headers["Retry-After"] = String(retryAfter);
  }
  return problemResponse(429, "Too Many Requests", detail, requestId, {
    code: "too_many_requests",
    headers,
  });
}

export function successListResponse<T, TMeta extends Record<string, unknown>>(
  data: T[],
  meta: TMeta,
  options?: { requestId?: string; cache?: string }
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": options?.cache ?? CACHE_NO_STORE,
  };
  if (options?.requestId) {
    headers["X-Request-Id"] = options.requestId;
  }
  return Response.json({ data, meta }, { status: 200, headers });
}
