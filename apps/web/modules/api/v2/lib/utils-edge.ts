// Function is this file can be used in edge runtime functions, like api routes.
import { IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@formbricks/logger";

export const logApiErrorEdge = (request: Request, error: ApiErrorResponseV2): void => {
  const correlationId = request.headers.get("x-request-id") ?? "";

  // Send the error to Sentry if the DSN is set and the error type is internal_server_error
  // This is useful for tracking down issues without overloading Sentry with errors
  if (SENTRY_DSN && IS_PRODUCTION && error.type === "internal_server_error") {
    const err = new Error(`API V2 error, id: ${correlationId}`);

    Sentry.captureException(err, {
      extra: {
        details: error.details,
        type: error.type,
        correlationId,
      },
    });
  }

  logger
    .withContext({
      correlationId,
      error,
    })
    .error("API Error Details");
};
