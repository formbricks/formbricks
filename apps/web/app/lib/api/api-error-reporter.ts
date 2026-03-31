import * as Sentry from "@sentry/nextjs";
import { logger } from "@formbricks/logger";
import { IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";

type TRequestLike = Pick<Request, "method" | "url" | "headers">;

type TApiRequestContext = {
  apiVersion: TApiVersion;
  correlationId: string;
  method: string;
  path: string;
  routeScope: string;
  status: number;
};

export type TApiVersion = "v1" | "v2" | "v3" | "unknown";

const getPathname = (url: string): string => {
  if (url.startsWith("/")) {
    return url;
  }

  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

const getApiRouteScope = (pathname: string): string => {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "api") {
    return "unknown";
  }

  return segments[2] ?? "unknown";
};

export const getApiVersionFromPath = (pathname: string): TApiVersion => {
  const match = /^\/api\/(v\d+)(?:\/|$)/.exec(pathname);

  if (!match) {
    return "unknown";
  }

  switch (match[1]) {
    case "v1":
    case "v2":
    case "v3":
      return match[1];
    default:
      return "unknown";
  }
};

const serializeError = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (value instanceof Error) {
    const serializedError: Record<string, unknown> = {
      name: value.name,
      message: value.message,
    };

    if (value.stack) {
      serializedError.stack = value.stack;
    }

    if ("cause" in value && value.cause !== undefined) {
      serializedError.cause = serializeError(value.cause, seen);
    }

    for (const [key, entryValue] of Object.entries(value as unknown as Record<string, unknown>)) {
      serializedError[key] = serializeError(entryValue, seen);
    }

    return serializedError;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeError(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      serializeError(entryValue, seen),
    ])
  );
};

const getSerializedValueType = (value: unknown): string => {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (value instanceof Error) {
    return value.name;
  }

  return typeof value;
};

const serializeErrorSafely = (value: unknown): unknown => {
  try {
    return serializeError(value);
  } catch (serializationError) {
    return {
      name: "ErrorSerializationFailed",
      message: "Failed to serialize API error payload",
      originalType: getSerializedValueType(value),
      serializationError:
        serializationError instanceof Error ? serializationError.message : String(serializationError),
    };
  }
};

const getSyntheticError = (apiVersion: TApiVersion, correlationId: string): Error => {
  if (apiVersion === "unknown") {
    return new Error(`API error, id: ${correlationId}`);
  }

  return new Error(`API ${apiVersion.toUpperCase()} error, id: ${correlationId}`);
};

const getLogMessage = (apiVersion: TApiVersion): string => {
  switch (apiVersion) {
    case "v1":
      return "V1 API Error Details";
    case "v2":
      return "API V2 Error Details";
    case "v3":
      return "API V3 Error Details";
    default:
      return "API Error Details";
  }
};

const buildApiRequestContext = (request: TRequestLike, status: number): TApiRequestContext => {
  const path = getPathname(request.url);

  return {
    apiVersion: getApiVersionFromPath(path),
    correlationId: request.headers.get("x-request-id") ?? "",
    method: request.method,
    path,
    routeScope: getApiRouteScope(path),
    status,
  };
};

const emitApiErrorLog = (context: TApiRequestContext, errorPayload: unknown): void => {
  logger
    .withContext({
      ...context,
      error: errorPayload,
    })
    .error(getLogMessage(context.apiVersion));
};

const emitSentryApiError = ({
  context,
  errorPayload,
  capturedError,
}: {
  context: TApiRequestContext;
  errorPayload: unknown;
  capturedError: Error;
}): void => {
  Sentry.withScope((scope) => {
    scope.setTag("apiVersion", context.apiVersion);
    scope.setTag("method", context.method);
    scope.setTag("routeScope", context.routeScope);
    scope.setLevel("error");
    scope.setContext("apiRequest", {
      apiVersion: context.apiVersion,
      method: context.method,
      path: context.path,
      routeScope: context.routeScope,
      status: context.status,
      ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    });
    scope.setExtra("error", errorPayload);
    scope.setExtra("originalError", errorPayload);

    Sentry.captureException(capturedError);
  });
};

const logReporterFailure = (context: TApiRequestContext, reportingError: unknown): void => {
  try {
    logger.error(
      {
        apiVersion: context.apiVersion,
        path: context.path,
        status: context.status,
        reportingError: serializeErrorSafely(reportingError),
      },
      "Failed to report API error"
    );
  } catch {
    // Swallow reporter failures so observability never breaks API responses.
  }
};

export const reportApiError = ({
  request,
  status,
  error,
}: {
  request: TRequestLike;
  status: number;
  error?: unknown;
}): void => {
  const context = buildApiRequestContext(request, status);
  const fallbackError = getSyntheticError(context.apiVersion, context.correlationId);
  const errorPayload = serializeErrorSafely(error ?? fallbackError);
  const capturedError = error instanceof Error ? error : fallbackError;

  try {
    emitApiErrorLog(context, errorPayload);
  } catch (reportingError) {
    logReporterFailure(context, reportingError);
  }

  if (SENTRY_DSN && IS_PRODUCTION && status >= 500) {
    try {
      emitSentryApiError({
        context,
        errorPayload,
        capturedError,
      });
    } catch (reportingError) {
      logReporterFailure(context, reportingError);
    }
  }
};
