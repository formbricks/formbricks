import { MembersInfo } from "@/modules/organization/settings/teams/components/edit-memberships/members-info";
import { getMembershipByOrganizationId } from "@/modules/organization/settings/teams/lib/membership";
import { getTranslations } from "next-intl/server";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getInvitesByOrganizationId } from "@formbricks/lib/invite/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

interface EditMembershipsProps {
  organization: TOrganization;
  currentUserId: string;
  role: TOrganizationRole;
  canDoRoleManagement: boolean;
}

export const EditMemberships = async ({
  organization,
  currentUserId,
  role,
  canDoRoleManagement,
}: EditMembershipsProps) => {
  const members = await getMembershipByOrganizationId(organization.id);
  const invites = await getInvitesByOrganizationId(organization.id);
  const t = await getTranslations();

  const { isOwner, isManager } = getAccessFlags(role);

  const isOwnerOrManager = isOwner || isManager;

  return (
    <div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid-cols-20 grid h-12 content-center rounded-t-lg bg-slate-100 px-4 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-5">{t("common.full_name")}</div>
          <div className="col-span-5">{t("common.email")}</div>
          {canDoRoleManagement && <div className="col-span-5">{t("common.role")}</div>}
          <div className="col-span-5"></div>
        </div>

        {role && (
          <MembersInfo
            organization={organization}
            currentUserId={currentUserId}
            invites={invites ?? []}
            members={members ?? []}
            isOwnerOrManager={isOwnerOrManager}
            canDoRoleManagement={canDoRoleManagement}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          />
        )}
      </div>
    </div>
  );
};
