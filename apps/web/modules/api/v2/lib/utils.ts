// @ts-nocheck // We can remove this when we update the prisma client and the typescript version
// if we don't add this we get build errors with prisma due to type-nesting
import { AUDIT_LOG_ENABLED } from "@/lib/constants";
import { responses } from "@/modules/api/v2/lib/response";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { ZodCustomIssue, ZodIssue } from "zod";
import { logger } from "@formbricks/logger";
import { logApiErrorEdge } from "./utils-edge";

export const handleApiError = (
  request: Request,
  err: ApiErrorResponseV2,
  auditLog?: Parameters<typeof queueAuditEvent>[0]
): Response => {
  logApiError(request, err, auditLog);

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

export const logApiError = (
  request: Request,
  error: ApiErrorResponseV2,
  auditLog?: Parameters<typeof queueAuditEvent>[0]
): void => {
  logApiErrorEdge(request, error);

  // Only call queueAuditEvent if not in Edge runtime and auditLog is provided
  if (AUDIT_LOG_ENABLED && auditLog) {
    const correlationId = request.headers.get("x-request-id") ?? "";
    queueAuditEvent({
      ...auditLog,
      status: "failure",
      eventId: correlationId,
      apiUrl: request.url,
    }).catch((err) => logger.error({ err, correlationId }, "Failed to queue audit event from logApiError"));
  }
};
