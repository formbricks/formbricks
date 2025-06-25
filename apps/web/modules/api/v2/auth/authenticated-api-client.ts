import { buildAuditLogBaseObject } from "@/app/lib/api/with-api-logging";
import { handleApiError, logApiRequest } from "@/modules/api/v2/lib/utils";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { TAuditAction, TAuditTarget } from "@/modules/ee/audit-logs/types/audit-log";
import { ExtendedSchemas, HandlerFn, ParsedSchemas, apiWrapper } from "./api-wrapper";

export const authenticatedApiClient = async <S extends ExtendedSchemas>({
  request,
  schemas,
  externalParams,
  rateLimit = true,
  handler,
  action,
  targetType,
}: {
  request: Request;
  schemas?: S;
  externalParams?: Promise<Record<string, any>>;
  rateLimit?: boolean;
  handler: HandlerFn<ParsedSchemas<S>>;
  action?: TAuditAction;
  targetType?: TAuditTarget;
}): Promise<Response> => {
  try {
    const auditLog =
      action && targetType ? buildAuditLogBaseObject(action, targetType, request.url) : undefined;

    const response = await apiWrapper({
      request,
      schemas,
      externalParams,
      rateLimit,
      handler,
      auditLog,
    });

    if (response.ok) {
      if (auditLog) {
        auditLog.status = "success";
      }
      logApiRequest(request, response.status, auditLog);
    }

    return response;
  } catch (err) {
    if ("type" in err) {
      return handleApiError(request, err as ApiErrorResponseV2);
    }

    return handleApiError(request, {
      type: "internal_server_error",
      details: [{ field: "error", issue: "An error occurred while processing your request." }],
    });
  }
};
