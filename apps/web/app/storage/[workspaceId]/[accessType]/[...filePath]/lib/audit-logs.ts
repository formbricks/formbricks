import { createHash } from "node:crypto";
import { logger } from "@formbricks/logger";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { TActor, TAuditAction, TAuditStatus, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";

const FILE_ID_MARKER = "--fid--";

const getOrgId = async (workspaceId: string): Promise<string> => {
  try {
    return await getOrganizationIdFromWorkspaceId(workspaceId);
  } catch (error) {
    logger.error({ error }, "Failed to get organization ID for workspace");
    return UNKNOWN_DATA;
  }
};

const hashSegment = (segment: string): string =>
  createHash("sha256").update(segment).digest("hex").slice(0, 16);

/**
 * Builds a stable identifier for the exact storage object without the (respondent-supplied) file name:
 * `{workspaceId}/{accessType}/{directories}/{fileId.ext}`. The file id is the `--fid--` UUID the storage
 * layer appends on upload; a name without one is replaced by a hash.
 */
export const getFileAuditTargetId = (workspaceId: string, accessType: string, fileName: string): string => {
  let decoded = fileName;
  try {
    decoded = decodeURIComponent(fileName);
  } catch {
    // keep the raw value; it is only hashed or split below
  }

  const segments = decoded.split("/");
  const last = segments.pop() ?? "";
  const markerIndex = last.lastIndexOf(FILE_ID_MARKER);
  const objectId = markerIndex === -1 ? hashSegment(last) : last.slice(markerIndex + FILE_ID_MARKER.length);

  return [workspaceId, accessType, ...segments, objectId].join("/");
};

export const logFileAudit = async ({
  action,
  workspaceId,
  accessType,
  fileName,
  userId,
  userType = "user",
  status = "failure",
  failureReason,
  oldObject,
  metadata,
  apiUrl,
}: {
  action: TAuditAction;
  workspaceId: string;
  accessType?: string;
  fileName?: string;
  userId?: string;
  userType?: TActor;
  status?: TAuditStatus;
  failureReason?: string;
  oldObject?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  apiUrl: string;
}) => {
  try {
    const organizationId = await getOrgId(workspaceId);

    await queueAuditEvent({
      action,
      targetType: "file",
      userId: userId || UNKNOWN_DATA, // NOSONAR // We want to check for empty user IDs too
      userType,
      targetId:
        fileName && accessType
          ? getFileAuditTargetId(workspaceId, accessType, fileName)
          : `${workspaceId}:${accessType}`, // Generic target identifier when no object is known
      organizationId,
      status,
      newObject: {
        workspaceId,
        accessType,
        ...metadata,
        ...(failureReason && { failureReason }),
      },
      oldObject,
      apiUrl,
    });
  } catch (auditError) {
    logger.error({ error: auditError }, "Failed to log file audit event");
  }
};

export const logFileDeletion = (params: Omit<Parameters<typeof logFileAudit>[0], "action">) =>
  logFileAudit({ action: "deleted", ...params });
