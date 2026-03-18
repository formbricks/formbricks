import { getServerSession } from "next-auth";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { authenticateRequest } from "@/app/api/v1/auth";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";
import {
  type InvalidParam,
  problemBadRequest,
  problemInternalError,
  problemTooManyRequests,
  problemUnauthorized,
} from "./response";
import type { TV3Authentication } from "./types";

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
};

export type TWithV3ApiWrapperParams<S extends TV3Schemas | undefined, TProps = unknown> = {
  auth?: TV3AuthMode;
  schemas?: S;
  rateLimit?: boolean;
  customRateLimitConfig?: TRateLimitConfig;
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
  return error.issues.map((issue) => ({
    name: issue.path.length > 0 ? issue.path.join(".") : fallbackName,
    reason: issue.message,
  }));
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

export const withV3ApiWrapper = <S extends TV3Schemas | undefined, TProps = unknown>(
  params: TWithV3ApiWrapperParams<S, TProps>
): ((req: NextRequest, props: TProps) => Promise<Response>) => {
  const { auth = "both", schemas, rateLimit = true, customRateLimitConfig, handler } = params;

  return async (req: NextRequest, props: TProps): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    const instance = req.nextUrl.pathname;
    const log = logger.withContext({
      requestId,
      method: req.method,
      path: instance,
    });

    try {
      const authentication = await authenticateV3Request(req, auth);
      if (!authentication && auth !== "none") {
        return problemUnauthorized(requestId, getUnauthenticatedDetail(auth), instance);
      }

      const parsedInputResult = await parseV3Input(req, props, schemas, requestId, instance);
      if (!parsedInputResult.ok) {
        return parsedInputResult.response;
      }

      if (rateLimit) {
        const identifier = getRateLimitIdentifier(authentication);
        if (identifier) {
          try {
            await applyRateLimit(customRateLimitConfig ?? rateLimitConfigs.api.v3, identifier);
          } catch (error) {
            log.warn({ error, statusCode: 429 }, "V3 API rate limit exceeded");
            return problemTooManyRequests(
              requestId,
              error instanceof Error ? error.message : "Rate limit exceeded",
              error instanceof TooManyRequestsError ? error.retryAfter : undefined
            );
          }
        }
      }

      const response = await handler({
        req,
        props,
        authentication,
        parsedInput: parsedInputResult.parsedInput,
        requestId,
        instance,
      });

      return ensureRequestIdHeader(response, requestId);
    } catch (error) {
      log.error({ error, statusCode: 500 }, "V3 API unexpected error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
  };
};
