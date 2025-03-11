import { responses } from "@/modules/api/v2/lib/response";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ZodError } from "zod";
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
      return responses.conflictResponse();
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

export const formatZodError = (error: ZodError) => {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    issue: issue.message,
  }));
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
  const correlationId = request.headers.get("x-request-id") || "";
  logger
    .withContext({
      correlationId,
      error,
    })
    .error("API Error Details");
};
