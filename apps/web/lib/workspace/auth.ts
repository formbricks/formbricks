import "server-only";
import { ZId } from "@formbricks/types/common";
import { can } from "@/lib/authorization";
import { validateInputs } from "../utils/validate";

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
): Promise<boolean> => {
  validateInputs([userId, ZId], [workspaceId, ZId]);
  return can({ type: "user", id: userId }, "workspace.write", { type: "workspace", id: workspaceId });
};

/**
 * Read-only counterpart for routes that only surface a connected integration's data. Unlike
 * {@link canUserNavigateWorkspace} this still excludes the `billing` role.
 */
export const canUserReadWorkspaceIntegrations = async (
  userId: string,
  workspaceId: string
): Promise<boolean> => {
  validateInputs([userId, ZId], [workspaceId, ZId]);
  return can({ type: "user", id: userId }, "workspace.read", { type: "workspace", id: workspaceId });
};

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
 * Membership in the owning organization is asked for first so that this
 * composition does not depend on a projected team edge carrying current organization membership.
 * The SpiceDB definition is `reader + reader_team +
 * write`, where `reader_team` is a projected `team#member` edge that carries no
 * membership requirement of its own. `TeamUser` has no foreign key to `Membership`
 * (it cascades from `Team` and `User` only), so "removed from the organization" and
 * "still has a team row" are separable states in the schema; `deleteMembership`
 * closes both in one serializable transaction and reconciles the projection, so a
 * stale edge should not exist. This states the precondition rather than inheriting
 * it, which is what keeps the two evaluators answering alike here.
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
  const organization = { type: "organization", id: workspace.organizationId } as const;

  if (!(await can(actor, "organization.read", organization))) return false;

  if (await can(actor, "workspace.read", { type: "workspace", id: workspace.id })) return true;

  return can(actor, "organization.manage_billing", organization);
};
