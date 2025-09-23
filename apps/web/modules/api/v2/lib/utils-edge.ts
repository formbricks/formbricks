// Function is this file can be used in edge runtime functions, like api routes.
import * as Sentry from "@sentry/nextjs";
import { logger } from "@formbricks/logger";
import { IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

export const logApiErrorEdge = (request: Request, error: ApiErrorResponseV2): void => {
  const correlationId = request.headers.get("x-request-id") ?? "";

  // Send the error to Sentry if the DSN is set and the error type is internal_server_error
  // This is useful for tracking down issues without overloading Sentry with errors
  if (SENTRY_DSN && IS_PRODUCTION && error.type === "internal_server_error") {
    // Use Sentry scope to add correlation ID as a tag for easy filtering
    Sentry.withScope((scope) => {
      scope.setTag("correlationId", correlationId);
      scope.setLevel("error");

      scope.setExtra("originalError", error);
      const err = new Error(`API V2 error, id: ${correlationId}`);
      Sentry.captureException(err);
    });
  }

  logger
    .withContext({
      correlationId,
      error,
    })
    .error("API V2 Error Details");
};
