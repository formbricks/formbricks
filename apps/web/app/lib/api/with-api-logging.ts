import { responses } from "@/app/lib/api/response";
import { AUDIT_LOG_ENABLED, IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { TAuditAction, TAuditTarget, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@formbricks/logger";

export type ApiAuditLog = Parameters<typeof queueAuditEvent>[0];

/**
 * withApiLogging wraps an V1 API handler to provide unified error/audit/system logging.
 * - Handler must return { response }.
 * - If not a successResponse, calls audit log, system log, and Sentry as needed.
 * - System and Sentry logs are always called for non-success responses.
 */
export const withApiLogging = <TResult extends { response: Response }>(
  handler: (req: Request, props?: any, auditLog?: ApiAuditLog) => Promise<TResult>,
  action: TAuditAction,
  targetType: TAuditTarget
) => {
  return async function (req: Request, props: any): Promise<Response> {
    const auditLog = buildAuditLogBaseObject(action, targetType, req.url);

    let result: { response: Response };
    let error: any = undefined;
    try {
      result = await handler(req, props, auditLog);
    } catch (err) {
      error = err;
      result = {
        response: responses.internalServerErrorResponse("An unexpected error occurred."),
      };
    }

    const res = result.response;
    // Try to parse the response as JSON to check if it's a success or error
    let isSuccess = false;
    let parsed: any = undefined;
    try {
      parsed = await res.clone().json();
      isSuccess = parsed && typeof parsed === "object" && "data" in parsed;
    } catch {
      isSuccess = false;
    }

    const correlationId = req.headers.get("x-request-id") ?? "";

    if (!isSuccess) {
      if (auditLog) {
        auditLog.eventId = correlationId;
      }

      // System log
      const logContext: any = {
        correlationId,
        method: req.method,
        path: req.url,
        status: res.status,
      };
      if (error) {
        logContext.error = error;
      }
      logger.withContext(logContext).error("API Error Details");
      // Sentry log
      if (SENTRY_DSN && IS_PRODUCTION && res.status === 500) {
        const err = new Error(`API V1 error, id: ${correlationId}`);
        Sentry.captureException(err, {
          extra: {
            error,
            correlationId,
          },
        });
      }
    } else {
      auditLog.status = "success";
    }

    if (AUDIT_LOG_ENABLED && auditLog) {
      queueAuditEvent(auditLog);
    }

    return res;
  };
};

export const buildAuditLogBaseObject = (
  action: TAuditAction,
  targetType: TAuditTarget,
  apiUrl: string
): ApiAuditLog => {
  return {
    action,
    targetType,
    userId: UNKNOWN_DATA,
    targetId: UNKNOWN_DATA,
    organizationId: UNKNOWN_DATA,
    status: "failure",
    oldObject: undefined,
    newObject: undefined,
    userType: "api",
    apiUrl,
  };
};
