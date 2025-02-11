import { responses } from "@/modules/api/lib/response";
import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { ZodError } from "zod";

export const handleApiError = (err: ApiErrorResponse): Response => {
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
      return responses.internalServerErrorResponse({ details: err.details });
    default:
      return responses.internalServerErrorResponse();
  }
};

export const formatZodError = (error: ZodError) => {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    issue: issue.message,
  }));
};
