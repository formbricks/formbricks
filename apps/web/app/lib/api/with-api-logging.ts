import { responses } from "@/app/lib/api/response";
import { AUDIT_LOG_ENABLED, IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/utils";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@formbricks/logger";

export type ApiAuditLog = Omit<Parameters<typeof queueAuditEvent>[0], "userType" | "apiUrl">;

/**
 * withApiLogging wraps an API handler to provide unified error/audit/system logging.
 * - Handler must return { response, audit }.
 * - If not a successResponse, calls audit log, system log, and Sentry as needed.
 * - System and Sentry logs are always called for non-success responses.
 */
export function withApiLogging<
  TArgs extends any[],
  TResult extends { response: Response; audit?: ApiAuditLog },
>(handler: (req: Request, ...args: TArgs) => Promise<TResult>) {
  return async function (req: Request, ...args: TArgs): Promise<Response> {
    let result: { response: Response; audit?: ApiAuditLog };
    let error: any = undefined;
    try {
      result = await handler(req, ...args);
    } catch (err) {
      error = err;
      result = {
        response: responses.internalServerErrorResponse("An unexpected error occurred."),
        audit: undefined,
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
    const auditLog = result.audit
      ? { ...result.audit, userType: "api" as const, apiUrl: req.url }
      : undefined;

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
    }

    if (AUDIT_LOG_ENABLED && auditLog) {
      queueAuditEvent(auditLog);
    }

    return res;
  };
}
