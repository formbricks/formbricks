import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getMembershipsByUserId } from "@/modules/organization/settings/teams/lib/membership";
import { EditWhitelist } from "@/modules/organization/settings/whitelist/components/edit-whitelist/edit-whitelist";
import { OrganizationWhitelistActions } from "@/modules/organization/settings/whitelist/components/edit-whitelist/organization-whitelist-actions";
import { getTranslate } from "@/tolgee/server";
import { Suspense } from "react";
import { INVITE_DISABLED } from "@formbricks/lib/constants";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

interface WhitelistViewProps {
  membershipRole: TOrganizationRole;
  organization: TOrganization;
  currentUserId: string;
  environmentId: string;
}

const WhitelistLoading = () => (
  <div className="px-2">
    {Array.from(Array(2)).map((_, index) => (
      <div key={index} className="mt-4">
        <div className={`h-8 w-80 animate-pulse rounded-full bg-slate-200`} />
      </div>
    ))}
  </div>
);

export const WhitelistView = async ({
  membershipRole,
  organization,
  currentUserId,
  environmentId,
}: WhitelistViewProps) => {
  const t = await getTranslate();

  const userMemberships = await getMembershipsByUserId(currentUserId);
  const isLeaveOrganizationDisabled = userMemberships.length <= 1;

  const isMultiOrgEnabled = false;

  return (
    <SettingsCard
      title={t("environments.settings.general.manage_whitelist")}
      description={t("environments.settings.general.manage_whitelist_description")}>
      {membershipRole && (
        <OrganizationWhitelistActions
          organization={organization}
          membershipRole={membershipRole}
          role={membershipRole}
          isLeaveOrganizationDisabled={isLeaveOrganizationDisabled}
          isInviteDisabled={INVITE_DISABLED}
          environmentId={environmentId}
          isMultiOrgEnabled={isMultiOrgEnabled}
        />
      )}

      {membershipRole && (
        <Suspense fallback={<WhitelistLoading />}>
          <EditWhitelist organization={organization} role={membershipRole} />
        </Suspense>
      )}
    </SettingsCard>
  );
};
