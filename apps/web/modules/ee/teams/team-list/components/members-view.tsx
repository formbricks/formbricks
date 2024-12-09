import { getMembershipsByUserId } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/lib/membership";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getIsMultiOrgEnabled, getRoleManagementPermission } from "@/modules/ee/license-check/lib/utils";
import { EditMemberships } from "@/modules/ee/teams/team-list/components/EditMemberships";
import { OrganizationActions } from "@/modules/ee/teams/team-list/components/EditMemberships/OrganizationActions";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { INVITE_DISABLED, IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

interface MembersViewProps {
  membershipRole?: TOrganizationRole;
  organization: TOrganization;
  currentUserId: string;
  environmentId: string;
}

const MembersLoading = () => (
  <div className="px-2">
    {Array.from(Array(2)).map((_, index) => (
      <div key={index} className="mt-4">
        <div className={`h-8 w-80 animate-pulse rounded-full bg-slate-200`} />
      </div>
    ))}
  </div>
);

export const MembersView = async ({
  membershipRole,
  organization,
  currentUserId,
  environmentId,
}: MembersViewProps) => {
  const t = await getTranslations();

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isUserManagerOrOwner = isManager || isOwner;

  const userMemberships = await getMembershipsByUserId(currentUserId);
  const isLeaveOrganizationDisabled = userMemberships.length <= 1;

  const canDoRoleManagement = await getRoleManagementPermission(organization);
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();

  const currentUserMembership = await getMembershipByUserIdOrganizationId(currentUserId, organization.id);

  return (
    <SettingsCard
      title={t("environments.settings.general.manage_members")}
      description={t("environments.settings.general.manage_members_description")}>
      {membershipRole && (
        <OrganizationActions
          organization={organization}
          isUserManagerOrOwner={isUserManagerOrOwner}
          role={membershipRole}
          isLeaveOrganizationDisabled={isLeaveOrganizationDisabled}
          isInviteDisabled={INVITE_DISABLED}
          canDoRoleManagement={canDoRoleManagement}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          environmentId={environmentId}
          isMultiOrgEnabled={isMultiOrgEnabled}
        />
      )}

      {currentUserMembership && (
        <Suspense fallback={<MembersLoading />}>
          <EditMemberships
            organization={organization}
            currentUserId={currentUserId}
            allMemberships={userMemberships}
            currentUserMembership={currentUserMembership}
          />
        </Suspense>
      )}
    </SettingsCard>
  );
};
