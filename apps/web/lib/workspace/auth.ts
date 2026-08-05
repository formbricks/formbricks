import "server-only";
import { ZId } from "@formbricks/types/common";
import { can } from "@/lib/authorization";
import type { LegacyWorkspaceAction } from "@/lib/authorization/legacy-workspace-access";
import { validateInputs } from "../utils/validate";

export type WorkspaceAction = LegacyWorkspaceAction;

const ACTION_PERMISSION = {
  GET: "workspace.read",
  POST: "workspace.write",
  PUT: "workspace.write",
  PATCH: "workspace.write",
  DELETE: "workspace.manage",
} as const satisfies Record<WorkspaceAction, "workspace.read" | "workspace.write" | "workspace.manage">;

/**
 * Compatibility wrapper for action-aware workspace access.
 *
 * @deprecated New authorization-sensitive code must call `can` or `assertCan`
 * with the semantic workspace action directly.
 */
export const hasUserWorkspaceAccessForAction = async (
  userId: string,
  workspaceId: string,
  action: WorkspaceAction
): Promise<boolean> => {
  validateInputs([userId, ZId], [workspaceId, ZId]);

  return can({ type: "user", id: userId }, ACTION_PERMISSION[action], { type: "workspace", id: workspaceId });
};

/**
 * Authorization for the integration OAuth routes (Notion / Airtable / Slack / Google Sheets).
 *
 * These are credential *mutations* delivered over GET: completing the flow writes the workspace's
 * third-party credentials, after which survey responses are forwarded to whichever account was
 * connected. They must therefore be gated on readWrite, not on mere workspace access —
 * {@link canUserNavigateWorkspace} admits the `billing` role (which is otherwise excluded from all
 * product data) and `workspace.read` admits a `read`-only team member, either of whom could otherwise
 * bind their own account as the workspace integration and start receiving another team's responses, or
 * overwrite the credentials an admin configured.
 */
export const canUserWriteWorkspaceIntegrations = async (
  userId: string,
  workspaceId: string
): Promise<boolean> => hasUserWorkspaceAccessForAction(userId, workspaceId, "POST");

/**
 * Read-only counterpart for routes that only surface a connected integration's data. Unlike
 * {@link canUserNavigateWorkspace} this still excludes the `billing` role.
 */
export const canUserReadWorkspaceIntegrations = async (
  userId: string,
  workspaceId: string
): Promise<boolean> => hasUserWorkspaceAccessForAction(userId, workspaceId, "GET");

/**
 * Whether a user may land on a workspace URL at all — the navigation/layout gate,
 * as opposed to a gate on any of the workspace's data.
 *
 * Reaching a workspace is deliberately broader than reading it: the `billing` role
 * is excluded from all product data but must still be able to follow a workspace
 * link, because that is how it arrives at the billing screens the layout redirects
 * it to. Expressed in the central vocabulary that is exactly:
 *
 *     workspace.read  OR  organization.manage_billing
 *
 * `workspace.read` covers owners and managers (through `organization#manage`) and
 * any team member holding a `WorkspaceTeam` grant. `organization.manage_billing`
 * is `owner + manager + billing`, so the second check only ever adds the billing
 * role — an organization `member` with no grant for this workspace is in neither,
 * and is still refused. It is ordered second so the common case costs one check.
 *
 * Callers pass the resolved workspace rather than an id: every one of them has
 * already loaded it, and requiring the owning organization here keeps this helper
 * from hiding a lookup behind an authorization decision.
 */
export const canUserNavigateWorkspace = async (
  userId: string,
  workspace: Readonly<{ id: string; organizationId: string }>
): Promise<boolean> => {
  validateInputs([userId, ZId], [workspace.id, ZId], [workspace.organizationId, ZId]);

  const actor = { type: "user", id: userId } as const;

  if (await can(actor, "workspace.read", { type: "workspace", id: workspace.id })) return true;

  return can(actor, "organization.manage_billing", { type: "organization", id: workspace.organizationId });
};
