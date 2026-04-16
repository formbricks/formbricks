import { getServerSession } from "next-auth";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { authenticateRequest } from "@/app/api/v1/auth";
import { reportApiError } from "@/app/lib/api/api-error-reporter";
import { buildAuditLogBaseObject } from "@/app/lib/api/with-api-logging";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import type { TAuditAction, TAuditTarget } from "@/modules/ee/audit-logs/types/audit-log";
import {
  type InvalidParam,
  problemBadRequest,
  problemInternalError,
  problemTooManyRequests,
  problemUnauthorized,
} from "./response";
import type { TV3AuditLog, TV3Authentication } from "./types";

type TV3Schema = z.ZodTypeAny;
type MaybePromise<T> = T | Promise<T>;

export type TV3AuthMode = "none" | "session" | "apiKey" | "both";

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
  parsedInput: TParsedInput;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

export type TWithV3ApiWrapperParams<S extends TV3Schemas | undefined, TProps = unknown> = {
  auth?: TV3AuthMode;
  schemas?: S;
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

function formatZodIssues(error: z.ZodError, fallbackName: "body" | "query" | "params"): InvalidParam[] {
  return error.issues.flatMap((issue) => {
    if (issue.code === "unrecognized_keys" && issue.keys.length > 0) {
      const prefix = issue.path.length > 0 ? `${issue.path.join(".")}.` : "";
      return issue.keys.map((key) => ({
        name: `${prefix}${key}`,
        reason: "Unsupported field",
      }));
    }

    return [
      {
        name: issue.path.length > 0 ? issue.path.join(".") : fallbackName,
        reason: issue.message,
      },
    ];
  });
}

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

  if (authMode === "both" && req.headers.has("x-api-key")) {
    const apiKeyAuth = await authenticateRequest(req);
    if (apiKeyAuth) {
      return apiKeyAuth;
    }
  }

  if (authMode === "session" || authMode === "both") {
    const session = await getServerSession(authOptions);
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

async function parseV3Input<S extends TV3Schemas | undefined, TProps>(
  req: NextRequest,
  props: TProps,
  schemas: S | undefined,
  requestId: string,
  instance: string
): Promise<
  | { ok: true; parsedInput: TV3ParsedInput<S> }
  | {
      ok: false;
      response: Response;
    }
> {
  const parsedInput = {} as TV3ParsedInput<S>;

  if (schemas?.body) {
    let bodyData: unknown;

    try {
      bodyData = await req.json();
    } catch {
      return {
        ok: false,
        response: problemBadRequest(requestId, "Invalid request body", {
          instance,
          invalid_params: [{ name: "body", reason: "Malformed JSON input, please check your request body" }],
        }),
      };
    }

    const bodyResult = schemas.body.safeParse(bodyData);
    if (!bodyResult.success) {
      return {
        ok: false,
        response: problemBadRequest(requestId, "Invalid request body", {
          instance,
          invalid_params: formatZodIssues(bodyResult.error, "body"),
        }),
      };
    }

    parsedInput.body = bodyResult.data as TV3ParsedInput<S>["body"];
  }

  if (schemas?.query) {
    const queryResult = schemas.query.safeParse(searchParamsToObject(req.nextUrl.searchParams));
    if (!queryResult.success) {
      return {
        ok: false,
        response: problemBadRequest(requestId, "Invalid query parameters", {
          instance,
          invalid_params: formatZodIssues(queryResult.error, "query"),
        }),
      };
    }

    parsedInput.query = queryResult.data as TV3ParsedInput<S>["query"];
  }

  if (schemas?.params) {
    const paramsResult = schemas.params.safeParse(await getRouteParams(props));
    if (!paramsResult.success) {
      return {
        ok: false,
        response: problemBadRequest(requestId, "Invalid route parameters", {
          instance,
          invalid_params: formatZodIssues(paramsResult.error, "params"),
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

function enrichV3AuditLog(authentication: TV3Authentication, auditLog?: TV3AuditLog): void {
  if (!authentication || !auditLog) {
    return;
  }

  if ("user" in authentication && authentication.user?.id) {
    auditLog.userId = authentication.user.id;
    auditLog.userType = "user";
    return;
  }

  if ("apiKeyId" in authentication) {
    auditLog.userId = authentication.apiKeyId;
    auditLog.userType = "api";
    auditLog.organizationId = authentication.organizationId;
  }
}

async function processV3Response(params: {
  response: Response;
  request: NextRequest;
  requestId: string;
  auditLog?: TV3AuditLog;
  error?: unknown;
}): Promise<Response> {
  const responseWithRequestId = ensureRequestIdHeader(params.response, params.requestId);

  if (params.auditLog) {
    params.auditLog.status = responseWithRequestId.ok ? "success" : "failure";
    if (!responseWithRequestId.ok) {
      params.auditLog.eventId = params.requestId;
    }
  }

  if (!responseWithRequestId.ok) {
    reportApiError({
      request: params.request,
      status: responseWithRequestId.status,
      error: params.error,
      apiVersion: "v3",
    });
  }

  if (params.auditLog) {
    await queueAuditEvent(params.auditLog);
  }

  return responseWithRequestId;
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
    rateLimit = true,
    customRateLimitConfig,
    action,
    targetType,
    handler,
  } = params;

  return async (req: NextRequest, props: TProps): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    const instance = req.nextUrl.pathname;
    const auditLog = action && targetType ? buildAuditLogBaseObject(action, targetType, req.url) : undefined;
    const log = logger.withContext({
      requestId,
      method: req.method,
      path: instance,
    });

    try {
      const authResult = await authenticateV3RequestOrRespond(req, auth, requestId, instance);
      if (authResult.response) {
        log.warn({ statusCode: authResult.response.status }, "V3 API authentication failed");
        return await processV3Response({
          response: authResult.response,
          request: req,
          requestId,
          auditLog,
        });
      }
      enrichV3AuditLog(authResult.authentication, auditLog);

      const parsedInputResult = await parseV3Input(req, props, schemas, requestId, instance);
      if (!parsedInputResult.ok) {
        log.warn({ statusCode: parsedInputResult.response.status }, "V3 API request validation failed");
        return await processV3Response({
          response: parsedInputResult.response,
          request: req,
          requestId,
          auditLog,
        });
      }

      const rateLimitResponse = await applyV3RateLimitOrRespond({
        authentication: authResult.authentication,
        enabled: rateLimit,
        config: customRateLimitConfig ?? rateLimitConfigs.api.v3,
        requestId,
        log,
      });
      if (rateLimitResponse) {
        return await processV3Response({
          response: rateLimitResponse,
          request: req,
          requestId,
          auditLog,
        });
      }

      const response = await handler({
        req,
        props,
        authentication: authResult.authentication,
        parsedInput: parsedInputResult.parsedInput,
        requestId,
        instance,
        auditLog,
      });

      return await processV3Response({
        response,
        request: req,
        requestId,
        auditLog,
      });
    } catch (error) {
      log.error({ error, statusCode: 500 }, "V3 API unexpected error");
      return await processV3Response({
        response: problemInternalError(requestId, "An unexpected error occurred.", instance),
        request: req,
        requestId,
        auditLog,
        error,
      });
    }
  };
};
