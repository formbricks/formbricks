import "server-only";
import { actionClient } from "@/lib/utils/action-client";
import type { TAuditTarget } from "@/modules/ee/audit-logs/types/audit-log";
import { emitSecurityAudit } from "./security-audit";

/** Validation runs before the action body. Record its denial without copying rejected input. */
export const securityActionClient = (operation: string, targetType: TAuditTarget = "user", global = true) =>
  actionClient.use(async ({ ctx, next }) => {
    const result = await next();
    if (result.validationErrors) {
      await emitSecurityAudit({
        operation,
        target: { type: targetType, id: "unknown" },
        scope: global ? "global" : "unknown",
        status: "denied",
        source: "server-action",
        requestId: ctx.auditLoggingCtx.eventId,
        changes: { reason: "invalid_input" },
      });
    }
    return result;
  });
