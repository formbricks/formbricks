import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { TAuditStatus, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { logger } from "@formbricks/logger";

const getOrgId = async (environmentId: string): Promise<string> => {
  try {
    return await getOrganizationIdFromEnvironmentId(environmentId);
  } catch (error) {
    logger.error({ error }, "Failed to get organization ID for environment");
    return UNKNOWN_DATA;
  }
};

export const logFileDeletion = async ({
  environmentId,
  accessType,
  userId,
  status = "failure",
  failureReason,
  oldObject,
  apiUrl,
}: {
  environmentId: string;
  accessType?: string;
  userId?: string;
  status?: TAuditStatus;
  failureReason?: string;
  oldObject?: Record<string, unknown>;
  apiUrl: string;
}) => {
  try {
    const organizationId = await getOrgId(environmentId);

    await queueAuditEvent({
      action: "deleted",
      targetType: "file",
      userId: userId || UNKNOWN_DATA, // NOSONAR // We want to check for empty user IDs too
      userType: "user",
      targetId: `${environmentId}:${accessType}`, // Generic target identifier
      organizationId,
      status,
      newObject: {
        environmentId,
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
