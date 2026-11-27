import type { ReactNode } from "react";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { getAccessFlags } from "@/lib/membership/utils";
import { getMemberAttributes } from "@/modules/ee/member-attributes/lib/service";
import { getInvitesByOrganizationId } from "@/modules/organization/settings/teams/lib/invite";
import { getMemberTeamsByOrganizationId } from "@/modules/organization/settings/teams/lib/member-teams";
import { getMembershipByOrganizationId } from "@/modules/organization/settings/teams/lib/membership";
import { MembersTable } from "./members-table";

interface EditMembershipsProps {
  readonly organization: TOrganization;
  readonly currentUserId: string;
  readonly role: TOrganizationRole;
  readonly isAccessControlAllowed: boolean;
  readonly isDashboardViewerRoleEnabled: boolean;
  readonly isUserManagementDisabledFromUi: boolean;
  readonly canManageUsers: boolean;
  readonly actions?: ReactNode;
}

/**
 * Loads the Members table's members, invites and teams on the server, as the page always has, and hands
 * them to the client table (ENG-7474). Member attributes are read by the table itself through the v3
 * endpoints — except the viewer's own values, read here, which a member who may not read everyone's sees
 * in their own Member settings.
 */
export const EditMemberships = async ({
  organization,
  currentUserId,
  role,
  isAccessControlAllowed,
  isDashboardViewerRoleEnabled,
  isUserManagementDisabledFromUi,
  canManageUsers,
  actions,
}: EditMembershipsProps) => {
  const { isOwner, isManager } = getAccessFlags(role);
  // Member attributes exist for Dashboard Viewer access, so they need what the role needs.
  const isMemberAttributesEnabled = isDashboardViewerRoleEnabled;
  const canManageMemberAttributes = isMemberAttributesEnabled && (isOwner || isManager);

  const [members, invites, { teamsByUserId, teamsByInviteId }, ownAttributes] = await Promise.all([
    getMembershipByOrganizationId(organization.id),
    getInvitesByOrganizationId(organization.id),
    getMemberTeamsByOrganizationId(organization.id),
    isMemberAttributesEnabled && !canManageMemberAttributes
      ? getMemberAttributes(organization.id, currentUserId)
      : Promise.resolve([]),
  ]);

  // Last sign-in is for Owners and Managers only (ENG-3317). Strip it here rather than hiding a column, so
  // it never reaches anyone else's page payload.
  const visibleMembers =
    isOwner || isManager ? members : members.map((member) => ({ ...member, lastLoginAt: undefined }));

  return (
    <MembersTable
      organizationId={organization.id}
      members={visibleMembers}
      invites={invites ?? []}
      teamsByUserId={teamsByUserId}
      teamsByInviteId={teamsByInviteId}
      currentUserId={currentUserId}
      currentUserRole={role}
      isAccessControlAllowed={isAccessControlAllowed}
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
      isDashboardViewerRoleEnabled={isDashboardViewerRoleEnabled}
      isUserManagementDisabledFromUi={isUserManagementDisabledFromUi}
      canManageUsers={canManageUsers}
      canManageMemberAttributes={canManageMemberAttributes}
      ownAttributes={ownAttributes.map(({ key, label, values }) => ({ key, label, values }))}
      reportingTimeZone={getReportingTimeZone(organization.displayTimeZone)}
      actions={actions}
    />
  );
};
