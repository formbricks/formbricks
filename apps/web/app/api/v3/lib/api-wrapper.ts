import { type NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { authenticateRequest } from "@/app/api/v1/auth";
import {
  DEFAULT_REQUEST_BODY_LIMIT_BYTES,
  RequestBodyTooLargeError,
  parseJsonBodyWithLimit,
  readRequestBodyBytesWithLimit,
} from "@/app/lib/api/request-body";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { getApiKeyFromHeaders } from "@/modules/api/lib/api-key-auth";
import { getSession } from "@/modules/auth/lib/session";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";
import { TAuditAction, TAuditTarget } from "@/modules/ee/audit-logs/types/audit-log";
import { buildV3AuditLog, queueV3AuditLog } from "./audit";
import {
  type InvalidParam,
  isInvalidParamCode,
  problemBadRequest,
  problemInternalError,
  problemPayloadTooLarge,
  problemTooManyRequests,
  problemUnauthorized,
  problemUnsupportedMediaType,
} from "./response";
import type { TV3AuditLog, TV3Authentication } from "./types";

type TV3Schema = z.ZodTypeAny;
type MaybePromise<T> = T | Promise<T>;

export type TV3AuthMode = "none" | "session" | "apiKey" | "both";

/** How the request body is read before `schemas.body` sees it. */
export type TV3BodyMode = "json" | "multipart";

export type TV3MultipartFile = {
  /** The form field name the file was sent under. */
  name: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
};

/** What a `body: "multipart"` route's body schema receives. */
export type TV3MultipartBody = {
  fields: Record<string, string>;
  files: TV3MultipartFile[];
};

export type TV3Schemas = {
  body?: TV3Schema;
  query?: TV3Schema;
  params?: TV3Schema;
};

export type TV3ParsedInput<S extends TV3Schemas | undefined> = S extends object
  ? {
      [K in keyof S as NonNullable<S[K]> extends TV3Schema ? K : never]: z.infer<NonNullable<S[K]>>;
    }
  : Record<string, never>;

export type TV3HandlerParams<TParsedInput = Record<string, never>, TProps = unknown> = {
  req: NextRequest;
  props: TProps;
  authentication: TV3Authentication;
  auditLog?: TV3AuditLog;
  parsedInput: TParsedInput;
  requestId: string;
  instance: string;
};

export type TWithV3ApiWrapperParams<S extends TV3Schemas | undefined, TProps = unknown> = {
  auth?: TV3AuthMode;
  schemas?: S;
  /** `json` (default) parses a JSON body; `multipart` reads `multipart/form-data` into fields + files. */
  body?: TV3BodyMode;
  /** Byte cap for the request body. Defaults to the 2 MB JSON limit. */
  bodyLimitBytes?: number;
  rateLimit?: boolean;
  customRateLimitConfig?: TRateLimitConfig;
  action?: TAuditAction;
  targetType?: TAuditTarget;
  handler: (params: TV3HandlerParams<TV3ParsedInput<S>, TProps>) => MaybePromise<Response>;
};

function getUnauthenticatedDetail(authMode: TV3AuthMode): string {
  if (authMode === "session") {
    return "Session required";
  }

  if (authMode === "apiKey") {
    return "API key required";
  }

  return "Not authenticated";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatZodIssues(error: z.ZodError, fallbackName: "body" | "query" | "params"): InvalidParam[] {
  return error.issues.map((issue) => {
    const params = "params" in issue && isPlainObject(issue.params) ? issue.params : {};
    const code = isInvalidParamCode(params.code) ? params.code : undefined;

    return {
      name: issue.path.length > 0 ? issue.path.join(".") : fallbackName,
      reason: issue.message,
      ...(code ? { code } : {}),
    };
  });
}

type TV3InputParseFailure = {
  ok: false;
  response: Response;
  detail: string;
  invalidParams: InvalidParam[];
};

function searchParamsToObject(searchParams: URLSearchParams): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};

  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    query[key] = values.length > 1 ? values : (values[0] ?? "");
  }

  return query;
}

function getRateLimitIdentifier(authentication: TV3Authentication): string | null {
  if (!authentication) {
    return null;
  }

  if ("user" in authentication && authentication.user?.id) {
    return authentication.user.id;
  }

  if ("apiKeyId" in authentication) {
    return authentication.apiKeyId;
  }

  return null;
}

function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return typeof value === "object" && value !== null && "then" in value;
}

async function getRouteParams<TProps>(props: TProps): Promise<Record<string, unknown>> {
  if (!props || typeof props !== "object" || !("params" in props)) {
    return {};
  }

  const params = (props as { params?: unknown }).params;
  if (!params) {
    return {};
  }

  const resolvedParams = isPromiseLike<Record<string, unknown>>(params) ? await params : params;
  return typeof resolvedParams === "object" && resolvedParams !== null
    ? (resolvedParams as Record<string, unknown>)
    : {};
}

async function authenticateV3Request(req: NextRequest, authMode: TV3AuthMode): Promise<TV3Authentication> {
  if (authMode === "none") {
    return null;
  }

  if (authMode === "both" && getApiKeyFromHeaders(req.headers)) {
    return await authenticateRequest(req);
  }

  if (authMode === "session" || authMode === "both") {
    const session = await getSession();
    if (session?.user?.id) {
      return session;
    }

    if (authMode === "session") {
      return null;
    }
  }

  if (authMode === "apiKey" || authMode === "both") {
    return await authenticateRequest(req);
  }

  return null;
}

function bodyParseFailure(requestId: string, instance: string, reason: string): TV3InputParseFailure {
  const invalidParams = [{ name: "body", reason }];
  return {
    ok: false,
    detail: "Invalid request body",
    invalidParams,
    response: problemBadRequest(requestId, "Invalid request body", {
      instance,
      invalid_params: invalidParams,
    }),
  };
}

function isMultipartRequest(req: NextRequest): boolean {
  return (req.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data");
}

/**
 * Read a multipart body into plain fields and files. The bytes are counted while reading (the
 * `Content-Length` header can be absent or wrong), then handed to the platform parser as a fresh
 * request so the boundary handling stays the runtime's job.
 */
async function readMultipartBody(req: NextRequest, limitBytes: number): Promise<TV3MultipartBody> {
  const bytes = await readRequestBodyBytesWithLimit(req, limitBytes);
  const formData = await new Request(req.url, {
    method: "POST",
    headers: { "content-type": req.headers.get("content-type") ?? "" },
    body: bytes,
  }).formData();

  const fields: Record<string, string> = {};
  const files: TV3MultipartFile[] = [];

  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") {
      fields[name] = value;
      continue;
    }

    files.push({
      name,
      fileName: value.name,
      mimeType: value.type,
      bytes: Buffer.from(await value.arrayBuffer()),
    });
  }

  return { fields, files };
}

async function readV3Body(
  req: NextRequest,
  mode: TV3BodyMode,
  limitBytes: number,
  requestId: string,
  instance: string
): Promise<{ ok: true; data: unknown } | TV3InputParseFailure> {
  if (mode === "multipart" && !isMultipartRequest(req)) {
    return {
      ok: false,
      detail: "Unsupported media type",
      invalidParams: [],
      response: problemUnsupportedMediaType(
        requestId,
        "This endpoint accepts multipart/form-data request bodies only",
        instance
      ),
    };
  }

  try {
    const data =
      mode === "multipart"
        ? await readMultipartBody(req, limitBytes)
        : await parseJsonBodyWithLimit(req, limitBytes);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return {
        ok: false,
        detail: error.message,
        invalidParams: [],
        response: problemPayloadTooLarge(requestId, error.message, instance),
      };
    }

    return bodyParseFailure(
      requestId,
      instance,
      mode === "multipart"
        ? "Malformed multipart form data, please check your request body"
        : "Malformed JSON input, please check your request body"
    );
  }
}

async function parseV3Input<S extends TV3Schemas | undefined, TProps>(
  req: NextRequest,
  props: TProps,
  schemas: S | undefined,
  requestId: string,
  instance: string,
  bodyOptions: { mode: TV3BodyMode; limitBytes: number } = {
    mode: "json",
    limitBytes: DEFAULT_REQUEST_BODY_LIMIT_BYTES,
  }
): Promise<{ ok: true; parsedInput: TV3ParsedInput<S> } | TV3InputParseFailure> {
  const parsedInput = {} as TV3ParsedInput<S>;

  if (schemas?.body) {
    const bodyRead = await readV3Body(req, bodyOptions.mode, bodyOptions.limitBytes, requestId, instance);
    if (!bodyRead.ok) {
      return bodyRead;
    }
    const bodyData: unknown = bodyRead.data;

    const bodyResult = schemas.body.safeParse(bodyData);
    if (!bodyResult.success) {
      const invalidParams = formatZodIssues(bodyResult.error, "body");
      return {
        ok: false,
        detail: "Invalid request body",
        invalidParams,
        response: problemBadRequest(requestId, "Invalid request body", {
          instance,
          invalid_params: invalidParams,
        }),
      };
    }

    parsedInput.body = bodyResult.data as TV3ParsedInput<S>["body"];
  }

  if (schemas?.query) {
    const queryResult = schemas.query.safeParse(searchParamsToObject(req.nextUrl.searchParams));
    if (!queryResult.success) {
      const invalidParams = formatZodIssues(queryResult.error, "query");
      return {
        ok: false,
        detail: "Invalid query parameters",
        invalidParams,
        response: problemBadRequest(requestId, "Invalid query parameters", {
          instance,
          invalid_params: invalidParams,
        }),
      };
    }

    parsedInput.query = queryResult.data as TV3ParsedInput<S>["query"];
  }

  if (schemas?.params) {
    const paramsResult = schemas.params.safeParse(await getRouteParams(props));
    if (!paramsResult.success) {
      const invalidParams = formatZodIssues(paramsResult.error, "params");
      return {
        ok: false,
        detail: "Invalid route parameters",
        invalidParams,
        response: problemBadRequest(requestId, "Invalid route parameters", {
          instance,
          invalid_params: invalidParams,
        }),
      };
    }

    parsedInput.params = paramsResult.data as TV3ParsedInput<S>["params"];
  }

  return { ok: true, parsedInput };
}

function ensureRequestIdHeader(response: Response, requestId: string): Response {
  if (response.headers.get("X-Request-Id")) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function authenticateV3RequestOrRespond(
  req: NextRequest,
  authMode: TV3AuthMode,
  requestId: string,
  instance: string
): Promise<
  { authentication: TV3Authentication; response: null } | { authentication: null; response: Response }
> {
  const authentication = await authenticateV3Request(req, authMode);

  if (!authentication && authMode !== "none") {
    return {
      authentication: null,
      response: problemUnauthorized(requestId, getUnauthenticatedDetail(authMode), instance),
    };
  }

  return {
    authentication,
    response: null,
  };
}

async function applyV3RateLimitOrRespond(params: {
  authentication: TV3Authentication;
  enabled: boolean;
  config: TRateLimitConfig;
  requestId: string;
  log: ReturnType<typeof logger.withContext>;
}): Promise<Response | null> {
  const { authentication, enabled, config, requestId, log } = params;
  if (!enabled) {
    return null;
  }

  const identifier = getRateLimitIdentifier(authentication);
  if (!identifier) {
    return null;
  }

  try {
    await applyRateLimit(config, identifier);
  } catch (error) {
    log.warn({ error, statusCode: 429 }, "V3 API rate limit exceeded");
    return problemTooManyRequests(
      requestId,
      error instanceof Error ? error.message : "Rate limit exceeded",
      error instanceof TooManyRequestsError ? error.retryAfter : undefined
    );
  }

  return null;
}

export const withV3ApiWrapper = <S extends TV3Schemas | undefined, TProps = unknown>(
  params: TWithV3ApiWrapperParams<S, TProps>
): ((req: NextRequest, props: TProps) => Promise<Response>) => {
  const {
    auth = "both",
    schemas,
    body: bodyMode = "json",
    bodyLimitBytes = DEFAULT_REQUEST_BODY_LIMIT_BYTES,
    rateLimit = true,
    customRateLimitConfig,
    handler,
    action,
    targetType,
  } = params;

  return async (req: NextRequest, props: TProps): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    const instance = req.nextUrl.pathname;
    const log = logger.withContext({
      requestId,
      method: req.method,
      path: instance,
    });
    let auditLog: TV3AuditLog | undefined;

    try {
      const authResult = await authenticateV3RequestOrRespond(req, auth, requestId, instance);
      if (authResult.response) {
        log.warn(
          { statusCode: authResult.response.status, detail: getUnauthenticatedDetail(auth) },
          "V3 API authentication failed"
        );
        return authResult.response;
      }

      const rateLimitResponse = await applyV3RateLimitOrRespond({
        authentication: authResult.authentication,
        enabled: rateLimit,
        config: customRateLimitConfig ?? rateLimitConfigs.api.v3,
        requestId,
        log,
      });
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const parsedInputResult = await parseV3Input(req, props, schemas, requestId, instance, {
        mode: bodyMode,
        limitBytes: bodyLimitBytes,
      });
      if (!parsedInputResult.ok) {
        log.warn(
          {
            statusCode: parsedInputResult.response.status,
            detail: parsedInputResult.detail,
            invalidParams: parsedInputResult.invalidParams,
          },
          "V3 API request validation failed"
        );
        return parsedInputResult.response;
      }

      auditLog = buildV3AuditLog(authResult.authentication, action, targetType, req.url);

      const execute = () =>
        handler({
          req,
          props,
          authentication: authResult.authentication,
          auditLog,
          parsedInput: parsedInputResult.parsedInput,
          requestId,
          instance,
        });
      const response = authResult.authentication
        ? await withAuthorizationSurface("api_v3", execute)
        : await execute();

      if (auditLog) {
        if (response.ok) {
          auditLog.status = "success";
        } else {
          auditLog.eventId = requestId;
        }
      }

      await queueV3AuditLog(auditLog, requestId, log);
      return ensureRequestIdHeader(response, requestId);
    } catch (error) {
      if (auditLog) {
        auditLog.eventId = requestId;
        await queueV3AuditLog(auditLog, requestId, log);
      }
      log.error({ error, statusCode: 500 }, "V3 API unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  };
};
