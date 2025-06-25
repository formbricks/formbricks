import { type TAuditLogEvent, ZAuditLogEventSchema } from "@/modules/ee/audit-logs/types/audit-log";
import { logger } from "@formbricks/logger";

const validateEvent = (event: TAuditLogEvent): void => {
  const result = ZAuditLogEventSchema.safeParse(event);
  if (!result.success) {
    throw new Error(`Invalid audit log event: ${result.error.message}`);
  }
};

export const logAuditEvent = async (event: TAuditLogEvent): Promise<void> => {
  try {
    validateEvent(event);
    logger.info(event, "Audit event logged");
  } catch (error) {
    // Log error to application logger but don't throw
    // This ensures audit logging failures don't break the application
    logger.error(error, "Failed to log audit event");
  }
};
