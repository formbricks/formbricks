import "server-only";
import { randomUUID } from "node:crypto";
import { AUDIT_LOG_ENABLED } from "@/lib/constants";
import { logAuditEvent } from "@/modules/ee/audit-logs/lib/service";
import type { TAuditLogEvent } from "@/modules/ee/audit-logs/types/audit-log";

/** Only pass allowlisted summaries. Never pass request bodies, tokens, users or caught errors. */
export const emitSecurityAudit = async ({
  operation,
  actor = { id: "unknown", type: "anonymous" },
  target = { id: "unknown", type: "user" },
  organizationId,
  scope = organizationId ? "organization" : "global",
  status,
  source,
  requestId = randomUUID(),
  action = "securityOperation",
  changes = {},
}: {
  operation: string;
  actor?: TAuditLogEvent["actor"];
  target?: TAuditLogEvent["target"];
  organizationId?: string;
  scope?: TAuditLogEvent["scope"];
  status: TAuditLogEvent["status"];
  source: string;
  requestId?: string;
  action?: TAuditLogEvent["action"];
  changes?: Record<string, unknown>;
}): Promise<void> => {
  if (!AUDIT_LOG_ENABLED) return;
  try {
    await logAuditEvent({
      actor,
      action,
      target,
      organizationId: organizationId ?? (scope === "global" ? "global" : "unknown"),
      scope,
      status,
      source,
      requestId,
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      changes: { operation, ...changes },
    });
  } catch {
    // Even a failed sink's error logger must not change the operation's response or original error.
  }
};
