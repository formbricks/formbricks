import {
  AuditLogEventSchema,
  type TAuditLogEvent,
  UNKNOWN_DATA,
} from "@/modules/ee/audit-logs/types/audit-log";
import { getOrganizationPlan } from "@/modules/ee/license-check/lib/license";
import { getIsAuditLogsEnabled } from "@/modules/ee/license-check/lib/utils";
import { logger } from "@formbricks/logger";
import { auditLogger } from "./logger";

function validateEvent(event: TAuditLogEvent): void {
  const result = AuditLogEventSchema.safeParse(event);
  if (!result.success) {
    throw new Error(`Invalid audit log event: ${result.error.message}`);
  }
}

async function hasAuditLogAccess(organizationId: string): Promise<boolean> {
  const billingPlan = organizationId === UNKNOWN_DATA ? undefined : await getOrganizationPlan(organizationId);

  return getIsAuditLogsEnabled(billingPlan);
}

export async function logAuditEvent(event: TAuditLogEvent): Promise<void> {
  try {
    if (!(await hasAuditLogAccess(event.organizationId))) {
      return;
    }

    validateEvent(event);

    auditLogger.info(event);
  } catch (error) {
    // Log error to application logger but don't throw
    // This ensures audit logging failures don't break the application
    logger.error(error, "Failed to log audit event");
  }
}
