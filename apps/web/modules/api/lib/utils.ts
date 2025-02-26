import { responses } from "@/modules/api/lib/response";
import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { ZodError } from "zod";

export const handleApiError = (request: Request, err: ApiErrorResponse): Response => {
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
    case "internal_server_error":
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

export const logApiRequest = (request: Request, responseStatus: number, duration: number): void => {
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname;
  const correlationId = request.headers.get("x-request-id") || "";
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const safeQueryParams = Object.fromEntries(
    Object.entries(queryParams).filter(([key]) => !["apikey", "token", "secret"].includes(key.toLowerCase()))
  );

  console.log(
    `[API REQUEST DETAILS] ${method} ${path} - ${responseStatus} - ${duration}ms${correlationId ? `\n correlationId: ${correlationId}` : ""}\n queryParams: ${JSON.stringify(safeQueryParams)}`
  );
};

export const logApiError = (request: Request, error: ApiErrorResponse): void => {
  const correlationId = request.headers.get("x-request-id") || "";
  console.error(
    `[API ERROR DETAILS]${correlationId ? `\n correlationId: ${correlationId}` : ""}\n error: ${JSON.stringify(error, null, 2)}`
  );
};
