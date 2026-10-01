import "server-only";
import { randomUUID } from "node:crypto";
import { isExpectedError } from "@formbricks/types/errors";
import { emitSecurityAudit } from "./security-audit";
import { securityAuditRequestContext } from "./security-audit-request-context";

type SecurityEvent = Parameters<typeof emitSecurityAudit>[0];
export type SecurityActionAudit = Omit<SecurityEvent, "status"> & { status?: SecurityEvent["status"] };

/** Mutable context contains safe IDs/summaries only; it is finalized after the operation settles. */
export const runSecurityAction = async <T>(
  audit: SecurityActionAudit,
  operation: () => Promise<T>
): Promise<T> => {
  const requestId = audit.requestId ?? randomUUID();
  try {
    const result = await securityAuditRequestContext.run(requestId, operation);
    await emitSecurityAudit({ ...audit, requestId, status: audit.status ?? "success" });
    return result;
  } catch (error) {
    await emitSecurityAudit({
      ...audit,
      requestId,
      status: error instanceof Error && isExpectedError(error) ? "denied" : "failure",
    });
    throw error;
  }
};
