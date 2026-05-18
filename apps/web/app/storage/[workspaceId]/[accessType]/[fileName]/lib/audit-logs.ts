import { logger } from "@formbricks/logger";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { TAuditStatus, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";

const getOrgId = async (workspaceId: string): Promise<string> => {
  try {
    return await getOrganizationIdFromWorkspaceId(workspaceId);
  } catch (error) {
    logger.error({ error }, "Failed to get organization ID for workspace");
    return UNKNOWN_DATA;
  }
};

export const logFileDeletion = async ({
  workspaceId,
  accessType,
  userId,
  status = "failure",
  failureReason,
  oldObject,
  apiUrl,
}: {
  workspaceId: string;
  accessType?: string;
  userId?: string;
  status?: TAuditStatus;
  failureReason?: string;
  oldObject?: Record<string, unknown>;
  apiUrl: string;
}) => {
  try {
    const organizationId = await getOrgId(workspaceId);

    await queueAuditEvent({
      action: "deleted",
      targetType: "file",
      userId: userId || UNKNOWN_DATA, // NOSONAR // We want to check for empty user IDs too
      userType: "user",
      targetId: `${workspaceId}:${accessType}`, // Generic target identifier
      organizationId,
      status,
      newObject: {
        workspaceId,
        accessType,
        ...(failureReason && { failureReason }),
      },
      oldObject,
      apiUrl,
    });
  } catch (auditError) {
    logger.error({ error: auditError }, "Failed to log file deletion audit event");
  }
};
