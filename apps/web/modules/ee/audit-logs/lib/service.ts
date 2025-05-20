import { AuditLogEventSchema, type TAuditLogEvent } from "@/modules/ee/audit-logs/types/audit-log";
import { logger } from "@formbricks/logger";
import { auditLogger } from "./logger";

// import { getLicenseFeatures } from "@/modules/ee/license-check/lib/license";

export class AuditLogService {
  private static validateEvent(event: TAuditLogEvent): void {
    const result = AuditLogEventSchema.safeParse(event);
    if (!result.success) {
      throw new Error(`Invalid audit log event: ${result.error.message}`);
    }
  }

  //   private static async hasAuditLogAccess(): Promise<boolean> {
  //     const features = await getLicenseFeatures();
  //     return features?.auditLogs ?? false;
  //   }

  static async logAuditEvent(event: TAuditLogEvent): Promise<void> {
    try {
      // if (!await this.hasAuditLogAccess()) {
      //     return;
      // }

      this.validateEvent(event);

      auditLogger.info(event);
    } catch (error) {
      // Log error to application logger but don't throw
      // This ensures audit logging failures don't break the application
      logger.error(error, "Failed to log audit event");
    }
  }
}

// Export a convenient function for logging audit events
export const logAuditEvent = AuditLogService.logAuditEvent.bind(AuditLogService);
