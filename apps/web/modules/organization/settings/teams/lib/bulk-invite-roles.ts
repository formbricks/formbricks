import { ZOrganizationRole } from "@formbricks/types/memberships";
import {
  type TAssignableRolesContext,
  getAssignableOrganizationRoles,
} from "@/modules/ee/role-management/lib/assignable-roles";

/**
 * The organization role a CSV cell names, lowercased, with spaces read as underscores so "Dashboard
 * viewer" and `dashboard_viewer` both work. Without Access Control everyone is invited as an owner, as
 * before; anything the role enum does not know is left for schema validation to reject.
 */
export const parseRoleCell = (cell: string, isAccessControlAllowed: boolean): string =>
  isAccessControlAllowed ? cell.trim().toLowerCase().replaceAll(/\s+/g, "_") : "owner";

export type TRefusedBulkInviteRoles = {
  billing: string[];
  dashboardViewer: string[];
  other: string[];
};

/**
 * The emails of the CSV rows whose role the inviter may not give, checked row by row against the rule
 * the role pickers and the server use (`getAssignableOrganizationRoles`). Billing and Dashboard viewer
 * rows are grouped apart because their refusal is about the plan, not the inviter.
 */
export const findRefusedBulkInviteRoles = (
  rows: ReadonlyArray<{ email: string; role: string }>,
  context: TAssignableRolesContext
): TRefusedBulkInviteRoles => {
  const assignable = new Set<string>(getAssignableOrganizationRoles(context));
  const refused: TRefusedBulkInviteRoles = { billing: [], dashboardViewer: [], other: [] };

  for (const { email, role } of rows) {
    if (!ZOrganizationRole.safeParse(role).success || assignable.has(role)) continue;
    if (role === "billing" && !context.isFormbricksCloud) refused.billing.push(email);
    else if (role === "dashboard_viewer" && !context.isDashboardViewerRoleEnabled)
      refused.dashboardViewer.push(email);
    else refused.other.push(email);
  }

  return refused;
};
