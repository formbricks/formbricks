import * as Sentry from "@sentry/nextjs";
import { logger } from "@formbricks/logger";
import { IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";

type TRequestLike = Pick<Request, "method" | "url" | "headers">;

type TApiErrorContext = {
  apiVersion: TApiVersion;
  correlationId: string;
  method: string;
  path: string;
  status: number;
};

type TSentryCaptureContext = NonNullable<Parameters<typeof Sentry.captureException>[1]>;

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

export const serializeErrorSafely = (value: unknown): unknown => {
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
      return "API V1 Error Details";
    case "v2":
      return "API V2 Error Details";
    case "v3":
      return "API V3 Error Details";
    default:
      return "API Error Details";
  }
};

const buildApiErrorContext = ({
  request,
  status,
  apiVersion,
}: {
  request: TRequestLike;
  status: number;
  apiVersion?: TApiVersion;
}): TApiErrorContext => {
  const path = getPathname(request.url);

  return {
    apiVersion: apiVersion ?? getApiVersionFromPath(path),
    correlationId: request.headers.get("x-request-id") ?? "",
    method: request.method,
    path,
    status,
  };
};

export const buildSentryCaptureContext = ({
  context,
  errorPayload,
  originalErrorPayload,
}: {
  context: TApiErrorContext;
  errorPayload: unknown;
  originalErrorPayload: unknown;
}): TSentryCaptureContext => ({
  level: "error",
  tags: {
    apiVersion: context.apiVersion,
    correlationId: context.correlationId,
    method: context.method,
    path: context.path,
  },
  extra: {
    error: errorPayload,
    originalError: originalErrorPayload,
  },
  contexts: {
    apiRequest: {
      apiVersion: context.apiVersion,
      correlationId: context.correlationId,
      method: context.method,
      path: context.path,
      status: context.status,
    },
  },
});

export const emitApiErrorLog = (context: TApiErrorContext, errorPayload?: unknown): void => {
  const logContext =
    errorPayload === undefined
      ? context
      : {
          ...context,
          error: errorPayload,
        };

  logger.withContext(logContext).error(getLogMessage(context.apiVersion));
};

export const emitApiErrorToSentry = ({
  error,
  captureContext,
}: {
  error: Error;
  captureContext: TSentryCaptureContext;
}): void => {
  Sentry.captureException(error, captureContext);
};

const logReporterFailure = (context: TApiErrorContext, reportingError: unknown): void => {
  try {
    logger.error(
      {
        apiVersion: context.apiVersion,
        correlationId: context.correlationId,
        method: context.method,
        path: context.path,
        status: context.status,
        reportingError: serializeErrorSafely(reportingError),
      },
      "Failed to report API error"
    );
  } catch {
    // Swallow reporter failures so API responses are never affected by observability issues.
  }
};

export const reportApiError = ({
  request,
  status,
  error,
  apiVersion,
  originalError,
}: {
  request: TRequestLike;
  status: number;
  error?: unknown;
  apiVersion?: TApiVersion;
  originalError?: unknown;
}): void => {
  const context = buildApiErrorContext({
    request,
    status,
    apiVersion,
  });
  const capturedError =
    error instanceof Error ? error : getSyntheticError(context.apiVersion, context.correlationId);
  const logErrorPayload = error === undefined ? undefined : serializeErrorSafely(error);
  const errorPayload = serializeErrorSafely(error ?? capturedError);
  const originalErrorPayload = serializeErrorSafely(originalError ?? error);

  try {
    emitApiErrorLog(context, logErrorPayload);
  } catch (reportingError) {
    logReporterFailure(context, reportingError);
  }

  if (SENTRY_DSN && IS_PRODUCTION && status >= 500) {
    try {
      emitApiErrorToSentry({
        error: capturedError,
        captureContext: buildSentryCaptureContext({
          context,
          errorPayload,
          originalErrorPayload,
        }),
      });
    } catch (reportingError) {
      logReporterFailure(context, reportingError);
    }
  }
};
