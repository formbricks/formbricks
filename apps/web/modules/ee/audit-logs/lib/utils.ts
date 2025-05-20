import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { logAuditEvent } from "@/modules/ee/audit-logs/lib/service";
import { AuditAction, AuditTargetType, TAuditLogEvent } from "@/modules/ee/audit-logs/types/audit-log";
import { cookies } from "next/headers";
import { logger } from "@formbricks/logger";

export function withAuditLogging(
  actionType: AuditAction,
  targetType: AuditTargetType,
  handler: (args: { ctx: any; parsedInput: any }) => Promise<any>
) {
  return async function wrappedAction(args: { ctx: any; parsedInput: any }) {
    const { ctx, parsedInput } = args;
    let result: any;
    let status: "success" | "failure" = "success";
    let error: any = undefined;

    try {
      result = await handler(args);
    } catch (err) {
      status = "failure";
      error = err;
    }

    try {
      const userId: string = ctx.user.id;
      let organizationId = parsedInput?.organizationId || ctx?.organizationId;

      // If organizationId is not set, try to get it from the environmentId
      if (!organizationId) {
        const environmentId: string | undefined = parsedInput?.environmentId;
        if (environmentId) {
          organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
        } else {
          organizationId = "anonymous";
        }
      }

      // Switch for targetId based on targetType
      let targetId: string | undefined;
      switch (targetType) {
        case "segment":
          targetId = ctx?.segmentId;
          break;
      }

      // Get client IP from cookie
      const cookieStore = await cookies();
      let ipAddress = cookieStore.get("client-ip")?.value || "anonymous";

      const auditEvent: TAuditLogEvent = {
        actor: { id: userId, type: "user" },
        action: { type: `${targetType}.${actionType}` },
        target: { id: targetId, type: targetType },
        timestamp: new Date().toISOString(),
        organizationId,
        status,
        ipAddress,
      };

      logAuditEvent(auditEvent);
    } catch (logError) {
      logger.error(logError, "Failed to create audit log event");
    }

    if (status === "failure") throw error;
    return result;
  };
}
