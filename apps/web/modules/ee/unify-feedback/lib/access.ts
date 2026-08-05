import "server-only";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";

/** Resolves the owning organization and refuses the call when Unify Feedback is not licensed. */
export const ensureUnifyEnabled = async (workspaceId: string): Promise<string> => {
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organizationId);
  if (!isFeedbackDirectoriesAllowed) {
    throw new OperationNotAllowedError("Unify Feedback is not enabled for this organization");
  }
  return organizationId;
};

/**
 * Reads are open to the whole workspace: seeing every record in a shared feedback directory is the
 * point of sharing it.
 */
export const ensureReadAccess = async (userId: string, workspaceId: string): Promise<void> => {
  const organizationId = await ensureUnifyEnabled(workspaceId);
  await checkAuthorizationUpdated({
    userId,
    organizationId,
    access: [
      {
        type: "organization",
        roles: ["owner", "manager"],
      },
      {
        type: "workspaceTeam",
        minPermission: "read",
        workspaceId,
      },
    ],
  });
};

/**
 * Deleting a record is restricted to organization owners and managers (ENG-1770).
 *
 * A record's only tenancy is its feedback directory (the Hub tenant), and a directory is shared by
 * every workspace it is assigned to — the record itself carries no workspace. A workspace
 * `readWrite` check therefore cannot tell this workspace's records from another workspace's, so a
 * member of workspace B could delete records that workspace A's surveys ingested. Until Hub records
 * carry a workspace, deleting stays with the roles that own org-level data.
 *
 * The access list must stay organization-only: adding a `workspaceTeam` entry here reopens ENG-1770,
 * which is why it is asserted directly in the tests.
 *
 * Returns the organization id so callers can attribute the audit event without resolving it again.
 */
export const ensureDeleteAccess = async (userId: string, workspaceId: string): Promise<string> => {
  const organizationId = await ensureUnifyEnabled(workspaceId);
  await checkAuthorizationUpdated({
    userId,
    organizationId,
    access: [
      {
        type: "organization",
        roles: ["owner", "manager"],
      },
    ],
  });
  return organizationId;
};

/** Ids of the feedback directories (Hub tenants) assigned to a workspace. */
export const getWorkspaceDirectoryIds = async (workspaceId: string): Promise<Set<string>> => {
  const directories = await getFeedbackDirectoriesByWorkspaceId(workspaceId);
  return new Set(directories.map((directory) => directory.id));
};

/**
 * Guard that a feedback record is reachable from a workspace at all: its `tenant_id` must be one of
 * the directories assigned to that workspace. A directory belongs to exactly one organization, so
 * this is the cross-organization boundary, and it holds no matter who is allowed to act on the record
 * (deleting additionally requires an organization owner/manager — see ENG-1770).
 *
 * Throws a "not found" rather than a "forbidden" on purpose: a distinguishable response would let a
 * caller probe which record ids exist elsewhere.
 */
export const assertRecordBelongsToWorkspace = (
  directoryIds: Set<string>,
  tenantId: string,
  recordId: string | null
): void => {
  if (!directoryIds.has(tenantId)) {
    throw new ResourceNotFoundError("Feedback record", recordId);
  }
};
