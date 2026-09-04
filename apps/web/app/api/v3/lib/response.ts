/**
 * V3 API response helpers — RFC 9457 Problem Details (application/problem+json)
 * and list envelope for success responses.
 */

const PROBLEM_JSON = "application/problem+json" as const;
const CACHE_NO_STORE = "private, no-store" as const;

/**
 * Authentication scheme advertised on a 401, as RFC 9110 §15.5.2 requires ("The server generating a 401
 * response MUST send a WWW-Authenticate header field"). v3 accepts a bearer API key, so RFC 6750 §3 is
 * the applicable challenge.
 *
 * The MCP surface sends its own richer challenge (with `resource_metadata` and `scope`) by overwriting
 * this header — see `withOAuthChallenge` in `@/modules/mcp/auth` — so a caller-supplied
 * `WWW-Authenticate` always wins over this default.
 */
const BEARER_CHALLENGE = 'Bearer realm="formbricks"' as const;

/**
 * The `code` vocabulary of this API's problem responses: a stable, locale-independent discriminator that
 * clients switch on instead of parsing `detail` (see `parseV3ApiError` in `@/modules/api/lib/v3-client`
 * and `responseToMcpToolResult` in `@/modules/mcp/errors`).
 *
 * This list is the source of truth. `Problem.yml` in the OpenAPI spec publishes the same set, and
 * `problem-codes.test.ts` fails if the two drift — the spec used to be hand-maintained, with nothing
 * checking it against the emitters. Codes are additive: removing or renaming one is a breaking change
 * for every client that branches on it.
 *
 * The last two are emitted by `@formbricks/workflows`, which mirrors this vocabulary rather than
 * importing it (it is a leaf package, deliberately dependency-free); its own `WORKFLOW_PROBLEM_CODES` is
 * held to this set by a drift test on the same spec file.
 */
export const V3_PROBLEM_CODES = [
  "ai_features_not_enabled",
  "ai_generated_payload_invalid",
  "ai_instance_not_configured",
  "ai_output_too_long",
  "ai_smart_tools_disabled",
  "bad_gateway",
  "bad_request",
  "conflict",
  "forbidden",
  "internal_server_error",
  "invalid_workflow_state",
  "not_authenticated",
  "not_found",
  "payload_too_large",
  "service_unavailable",
  "too_many_requests",
  "unprocessable_content",
  "workflow_not_executable",
] as const;

export type V3ProblemCode = (typeof V3_PROBLEM_CODES)[number];

const V3_PROBLEM_CODE_SET = new Set<V3ProblemCode>(V3_PROBLEM_CODES);

export function isV3ProblemCode(value: unknown): value is V3ProblemCode {
  return typeof value === "string" && V3_PROBLEM_CODE_SET.has(value as V3ProblemCode);
}

export const INVALID_PARAM_CODES = [
  "dangling_reference",
  "duplicate_identifier",
  "duplicate_locale",
  "forbidden_identifier",
  "immutable_identifier",
  "invalid_locale",
  "invalid_reference",
  "missing_required_field",
  "missing_translation",
  "unsupported_field",
  "unsupported_locale",
] as const;

export type InvalidParamCode = (typeof INVALID_PARAM_CODES)[number];

const INVALID_PARAM_CODE_SET = new Set<InvalidParamCode>(INVALID_PARAM_CODES);

export function isInvalidParamCode(value: unknown): value is InvalidParamCode {
  return typeof value === "string" && INVALID_PARAM_CODE_SET.has(value as InvalidParamCode);
}

export type InvalidParam = {
  name: string;
  reason: string;
  code?: InvalidParamCode;
  identifier?: string;
  referenceType?:
    | "block"
    | "element"
    | "ending"
    | "hiddenField"
    | "language"
    | "variable"
    | "variableName"
    | "recall";
  missingId?: string;
  firstUsedAt?: string;
  conflictsWith?: string;
};

export type ProblemExtension = {
  code?: V3ProblemCode;
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
    code?: V3ProblemCode;
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

export function problemPayloadTooLarge(
  requestId: string,
  detail: string = "Payload Too Large",
  instance?: string
): Response {
  return problemResponse(413, "Payload Too Large", detail, requestId, {
    code: "payload_too_large",
    instance,
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
    headers: { "WWW-Authenticate": BEARER_CHALLENGE },
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
 * An AI capability the caller cannot use: 503 when this deployment has no AI configured at all, 403 when
 * it is configured but not enabled for the organization.
 *
 * `title` is the HTTP reason phrase for the status, not a description of the cause. RFC 9457 §4.2.1
 * requires that of a problem whose `type` is absent (and therefore `about:blank`), which is every v3
 * problem. The cause is carried by `code`, which is what clients branch on anyway — see
 * `getAIErrorMessage` in `@/modules/survey/template-list/lib/ai-error-messages`.
 */
export function problemAIUnavailable(
  requestId: string,
  detail: string,
  code: V3ProblemCode,
  instance?: string
): Response {
  const isNotConfigured = code === "ai_instance_not_configured";

  return problemResponse(
    isNotConfigured ? 503 : 403,
    isNotConfigured ? "Service Unavailable" : "Forbidden",
    detail,
    requestId,
    { code, instance }
  );
}

export function problemUnprocessableContent(
  requestId: string,
  detail: string,
  options?: { invalid_params?: InvalidParam[]; instance?: string; code?: V3ProblemCode }
): Response {
  return problemResponse(422, "Unprocessable Content", detail, requestId, {
    code: options?.code ?? "unprocessable_content",
    instance: options?.instance,
    invalid_params: options?.invalid_params,
  });
}

export function problemConflict(requestId: string, detail: string, instance?: string): Response {
  return problemResponse(409, "Conflict", detail, requestId, {
    code: "conflict",
    instance,
  });
}

export function problemBadGateway(requestId: string, detail: string, instance?: string): Response {
  return problemResponse(502, "Bad Gateway", detail, requestId, {
    code: "bad_gateway",
    instance,
  });
}

/**
 * 503 for a capability that is not enabled on this deployment (as opposed to a transient outage, which
 * is a 502). `detail` should say what to configure — a bare "unavailable" is not actionable.
 */
export function problemServiceUnavailable(requestId: string, detail: string, instance?: string): Response {
  return problemResponse(503, "Service Unavailable", detail, requestId, {
    code: "service_unavailable",
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

export function problemTooManyRequests(
  requestId: string,
  detail: string,
  retryAfter?: number,
  instance?: string
): Response {
  const headers: Record<string, string> = {};
  if (retryAfter !== undefined) {
    headers["Retry-After"] = String(retryAfter);
  }
  return problemResponse(429, "Too Many Requests", detail, requestId, {
    code: "too_many_requests",
    instance,
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

export function successResponse<T>(
  data: T,
  options?: { requestId?: string; cache?: string; status?: number }
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": options?.cache ?? CACHE_NO_STORE,
  };

  if (options?.requestId) {
    headers["X-Request-Id"] = options.requestId;
  }

  return Response.json(
    {
      data,
    },
    {
      status: options?.status ?? 200,
      headers,
    }
  );
}

export function createdResponse<T>(
  data: T,
  options: { location: string; requestId?: string; cache?: string }
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": options.cache ?? CACHE_NO_STORE,
    Location: options.location,
  };

  if (options.requestId) {
    headers["X-Request-Id"] = options.requestId;
  }

  return Response.json(
    {
      data,
    },
    {
      status: 201,
      headers,
    }
  );
}

export function noContentResponse(options?: { requestId?: string; cache?: string }): Response {
  const headers: Record<string, string> = {
    "Cache-Control": options?.cache ?? CACHE_NO_STORE,
  };

  if (options?.requestId) {
    headers["X-Request-Id"] = options.requestId;
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}
