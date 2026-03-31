// Function is this file can be used in edge runtime functions, like api routes.
import { reportApiError } from "@/app/lib/api/api-error-reporter";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

const getStatusFromApiError = (error: ApiErrorResponseV2): number => {
  switch (error.type) {
    case "bad_request":
      return 400;
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "unprocessable_entity":
      return 422;
    case "too_many_requests":
      return 429;
    case "internal_server_error":
    default:
      return 500;
  }
};

export const logApiErrorEdge = (
  request: Request,
  error: ApiErrorResponseV2,
  originalError: unknown = error
): void => {
  reportApiError({
    request,
    status: getStatusFromApiError(error),
    error,
    originalError,
  });
};
