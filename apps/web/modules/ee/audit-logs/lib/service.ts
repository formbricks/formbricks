import { AuditLogEventSchema, type TAuditLogEvent } from "@/modules/ee/audit-logs/types/audit-log";
import { getIsAuditLogsEnabled } from "@/modules/ee/license-check/lib/utils";
import { logger } from "@formbricks/logger";
import { auditLogger } from "./logger";

const validateEvent = (event: TAuditLogEvent): void => {
  const result = AuditLogEventSchema.safeParse(event);
  if (!result.success) {
    throw new Error(`Invalid audit log event: ${result.error.message}`);
  }
};

const hasAuditLogAccess = async (): Promise<boolean> => {
  return true;
  return getIsAuditLogsEnabled();
};

export const logAuditEvent = async (event: TAuditLogEvent): Promise<void> => {
  try {
    if (!(await hasAuditLogAccess())) {
      return;
    }

    validateEvent(event);

    auditLogger.info(event);
  } catch (error) {
    // Log error to application logger but don't throw
    // This ensures audit logging failures don't break the application
    logger.error(error, "Failed to log audit event");
  }
};
