import { logger } from "@formbricks/logger";
import type { WorkflowApiContext } from "@formbricks/workflows/server";
import { buildV3AuditLog } from "@/app/api/v3/lib/audit";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { loggableError } from "@/lib/utils/loggable-error";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";

/**
 * "Secret set" / "secret replaced" audit events (ENG-7179, spec §8): one per secret header a workflow
 * write stored, beside the write's own "updated" event. The event names the step and header only;
 * the value never reaches this sink. Failures are logged, never thrown, since the write already
 * succeeded.
 */
export const buildRecordSecretHeaderChanges =
  (
    authentication: TV3Authentication,
    requestId: string,
    apiUrl: string
  ): NonNullable<WorkflowApiContext["recordSecretHeaderChanges"]> =>
  async ({ workflowId, workspaceId, changes }) => {
    try {
      const isApiKey = !!authentication && "apiKeyId" in authentication;
      const organizationId = isApiKey
        ? authentication.organizationId
        : await getOrganizationIdFromWorkspaceId(workspaceId);
      for (const change of changes) {
        const auditLog = buildV3AuditLog(
          authentication,
          change.change === "set" ? "secretHeaderSet" : "secretHeaderReplaced",
          "workflow",
          apiUrl
        );
        if (!auditLog) continue;
        await queueAuditEvent({
          ...auditLog,
          targetId: workflowId,
          organizationId,
          status: "success",
          newObject: { stepId: change.stepId, headerName: change.headerName },
        });
      }
    } catch (error) {
      logger
        .withContext({ requestId })
        .error(loggableError(error), "Failed to record workflow secret header audit");
    }
  };
