import { responses } from "@/modules/api/v2/lib/response";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ZodCustomIssue, ZodIssue } from "zod";
import { logger } from "@formbricks/logger";

export const handleApiError = (request: Request, err: ApiErrorResponseV2): Response => {
  logApiError(request, err);

  switch (err.type) {
    case "bad_request":
      return responses.badRequestResponse({ details: err.details });
    case "unauthorized":
      return responses.unauthorizedResponse();
    case "forbidden":
      return responses.forbiddenResponse();
    case "not_found":
      return responses.notFoundResponse({ details: err.details });
    case "conflict":
      return responses.conflictResponse({ details: err.details });
    case "unprocessable_entity":
      return responses.unprocessableEntityResponse({ details: err.details });
    case "too_many_requests":
      return responses.tooManyRequestsResponse();
    default:
      // Replace with a generic error message, because we don't want to expose internal errors to API users.
      return responses.internalServerErrorResponse({
        details: [
          {
            field: "error",
            issue: "An error occurred while processing your request. Please try again later.",
          },
        ],
      });
  }
};

export const formatZodError = (error: { issues: (ZodIssue | ZodCustomIssue)[] }) => {
  return error.issues.map((issue) => {
    const issueParams = issue.code === "custom" ? issue.params : undefined;

    return {
      field: issue.path.join("."),
      issue: issue.message ?? "An error occurred while processing your request. Please try again later.",
      ...(issueParams && { meta: issueParams }),
    };
  });
};

export const logApiRequest = (request: Request, responseStatus: number): void => {
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname;
  const correlationId = request.headers.get("x-request-id") || "";
  const startTime = request.headers.get("x-start-time") || "";
  const queryParams = Object.fromEntries(url.searchParams.entries());

  const sensitiveParams = ["apikey", "token", "secret"];
  const safeQueryParams = Object.fromEntries(
    Object.entries(queryParams).filter(([key]) => !sensitiveParams.includes(key.toLowerCase()))
  );

  // Info: Conveys general, operational messages about system progress and state.
  logger
    .withContext({
      method,
      path,
      responseStatus,
      duration: `${Date.now() - parseInt(startTime)} ms`,
      correlationId,
      queryParams: safeQueryParams,
    })
    .info("API Request Details");
};

export const logApiError = (request: Request, error: ApiErrorResponseV2): void => {
  const correlationId = request.headers.get("x-request-id") ?? "";

  // Send the error to Sentry if the DSN is set and the error type is internal_server_error
  // This is useful for tracking down issues without overloading Sentry with errors
  // if (process.env.SENTRY_DSN && error.type === "internal_server_error") {
  //   const err = new Error(`API V2 error, id: ${correlationId}`);

  //   Sentry.captureException(err, {
  //     extra: {
  //       details: error.details,
  //       type: error.type,
  //       correlationId,
  //     },
  //   });
  // }

  logger
    .withContext({
      correlationId,
      error,
    })
    .error("API Error Details");
};
