import type { TOrganizationRole } from "@formbricks/types/memberships";

export type TAssignableRolesContext = Readonly<{
  /** The organization role of the person inviting or editing. */
  assignerRole: TOrganizationRole | null | undefined;
  isFormbricksCloud: boolean;
  /** Access Control and Dashboards are both entitled (`getIsDashboardViewerRoleEnabled`). */
  isDashboardViewerRoleEnabled: boolean;
}>;

/**
 * The organization roles a person may give in an invite, a CSV bulk invite or a role edit, in the order
 * every picker lists them: most access first, Dashboard viewer last.
 *
 * - Owners give every role; Billing only on Formbricks Cloud.
 * - Managers give the roles below their own: Member and, like Member, Dashboard viewer.
 * - The Dashboard viewer is offered only while Access Control and Dashboards are both entitled (ADR-0025).
 * - Everyone else gives nothing here; team admins invite Members through the single invite's own rule
 *   (`POST /api/internal/invites`).
 *
 * Shared by the pickers and the server actions, so what the UI offers and what the server accepts are
 * one rule.
 */
export const getAssignableOrganizationRoles = ({
  assignerRole,
  isFormbricksCloud,
  isDashboardViewerRoleEnabled,
}: TAssignableRolesContext): TOrganizationRole[] => {
  if (assignerRole !== "owner" && assignerRole !== "manager") return [];

  const roles: TOrganizationRole[] = [];
  if (assignerRole === "owner") {
    if (isFormbricksCloud) roles.push("billing");
    roles.push("owner", "manager");
  }
  roles.push("member");
  if (isDashboardViewerRoleEnabled) roles.push("dashboard_viewer");

  return roles;
};

/**
 * Whether `role` may be given. On an existing membership, `targetCurrentRole` is its role now: only an
 * Owner changes an Owner's role, so a Manager can never demote one.
 */
export const canAssignOrganizationRole = (
  context: TAssignableRolesContext &
    Readonly<{ role: TOrganizationRole; targetCurrentRole?: TOrganizationRole | null }>
): boolean => {
  if (context.targetCurrentRole === "owner" && context.assignerRole !== "owner") return false;
  return getAssignableOrganizationRoles(context).includes(context.role);
};
