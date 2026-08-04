import type { ApiKeyPermission } from "@formbricks/database/prisma";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";

// Pure authorization logic for feedback records, shared by the gateway (`feedback-records-gateway.ts`)
// and the v3/MCP surface (`app/api/v3/feedbackRecords/lib/access.ts`) so one policy is not written
// twice. Kept free of server-only, Prisma, and env imports so it can be unit-tested in isolation (the
// gateway module itself pulls in the full request/DB/env stack).

export type TFeedbackRecordsGatewayPermission = "read" | "write" | "manage";

// The gateway vocabulary and `ApiKeyPermission` now have the same members, so route permissions index
// this table directly. Should the two ever diverge, indexing stops compiling — which is the point.
const apiKeyPermissionWeight: Record<ApiKeyPermission, number> = {
  read: 1,
  write: 2,
  manage: 3,
};

/**
 * Whether a workspace-scoped API key may change or destroy records that already exist in a feedback
 * directory — as opposed to reading them or adding new ones.
 *
 * A directory is the Hub tenant, and its records carry a `tenant_id` and nothing else: no workspace.
 * When two or more workspaces share a directory, no workspace permission can say whose records they
 * are, so a key holding `write` on workspace B would edit or delete records that workspace A's surveys
 * ingested (ENG-2189). Deriving the owning workspace from `source_id` is not available as a boundary:
 * CSV records may carry an arbitrary one, the v3/MCP/gateway write paths let a caller supply it
 * unvalidated, and the Hub cannot filter on a set of them. Until records carry a workspace of their
 * own, the only honest rule is that a key may mutate a directory it does not share with anyone.
 *
 * Reads and creates are deliberately excluded: reading everything in a shared directory is the point of
 * sharing it, and adding records is ordinary workspace work, the same as a CSV import.
 *
 * Expressed as `=== 1` rather than `<= 1`: a directory with no workspaces at all has no workspace whose
 * permission could authorize anything, so it refuses too, and the rule stays "exactly one workspace owns
 * these records" instead of "not more than one". Assigning a second workspace flips a directory to deny
 * on its own — the rule fails safe as sharing is introduced.
 */
export const canApiKeyMutateFeedbackDirectoryRecords = (workspaceIds: string[]): boolean =>
  workspaceIds.length === 1;

/**
 * Whether an API key may access a feedback directory's records.
 *
 * Feedback records are workspace-scoped DATA, so access is granted solely by the key's per-workspace
 * permissions (`workspacePermissions`) — never by `organizationAccess.accessControl`. That org-level
 * flag governs organization MANAGEMENT (members, teams, roles), not workspace data: the API-key UI
 * describes it as "Members and teams only — not workspace data", and every other consumer
 * (`hasOrganizationAccess`, the org users/teams endpoints) uses it only for org-admin operations.
 * Granting record access from it would let a members-management key read/write feedback data and
 * would make the workspace-permission check below redundant, so it is deliberately not consulted.
 *
 * Access additionally requires the key to belong to the directory's organization. The
 * workspace-permission match already implies the same organization (a key's `workspacePermissions`
 * only contain workspaces in its own org — see `authenticateApiKeyFromHeaders`), so the up-front
 * organization check is defense-in-depth: it keeps this decision correct on its own, and prevents
 * cross-tenant access (ENG-1980) even if that upstream invariant ever regresses.
 *
 * `isRecordMutation` additionally applies the shared-directory rule (ENG-2189). It is required rather
 * than defaulted so a call site added later has to state which side it is on instead of silently
 * getting the permissive branch.
 */
export const hasApiKeyImplicitFeedbackDirectoryAccess = (
  authentication: TAuthenticationApiKey,
  directoryOrganizationId: string,
  workspaceIds: string[],
  requiredPermission: TFeedbackRecordsGatewayPermission,
  isRecordMutation: boolean
): boolean => {
  // The key must belong to the directory's organization.
  if (authentication.organizationId !== directoryOrganizationId) {
    return false;
  }

  // Checked before the permission weight, because no amount of workspace permission can buy out of it:
  // in a shared directory the question is not "how much may this key do in workspace X" but "is X the
  // workspace these records belong to", and that is unanswerable.
  if (isRecordMutation && !canApiKeyMutateFeedbackDirectoryRecords(workspaceIds)) {
    return false;
  }

  const matchingWeights = authentication.workspacePermissions
    .filter((permission) => workspaceIds.includes(permission.workspaceId))
    .map((permission) => apiKeyPermissionWeight[permission.permission]);

  if (matchingWeights.length === 0) {
    return false;
  }

  const maxWeight = Math.max(...matchingWeights);
  return maxWeight >= apiKeyPermissionWeight[requiredPermission];
};
