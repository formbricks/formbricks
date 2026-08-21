import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { MembersInfo } from "@/modules/organization/settings/teams/components/edit-memberships/members-info";
import { getInvitesByOrganizationId } from "@/modules/organization/settings/teams/lib/invite";
import { getMembershipByOrganizationId } from "@/modules/organization/settings/teams/lib/membership";

interface EditMembershipsProps {
  organization: TOrganization;
  currentUserId: string;
  role: TOrganizationRole;
  isAccessControlAllowed: boolean;
  isUserManagementDisabledFromUi: boolean;
}

/**
 * The column headers used to live here, hand-rolled as a `grid-cols-12` of divs, while the rows lived in
 * `MembersInfo` — two files repeating the same `col-span-*` sequence and the same two feature flags. They
 * are now one column array in `MembersInfo`, which is where the flags already were.
 */
export const EditMemberships = async ({
  organization,
  currentUserId,
  role,
  isAccessControlAllowed,
  isUserManagementDisabledFromUi,
}: EditMembershipsProps) => {
  const members = await getMembershipByOrganizationId(organization.id);
  const invites = await getInvitesByOrganizationId(organization.id);

  if (!role) return null;

  return (
    <MembersInfo
      organization={organization}
      currentUserId={currentUserId}
      invites={invites ?? []}
      members={members ?? []}
      currentUserRole={role}
      isAccessControlAllowed={isAccessControlAllowed}
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
      isUserManagementDisabledFromUi={isUserManagementDisabledFromUi}
    />
  );
};
