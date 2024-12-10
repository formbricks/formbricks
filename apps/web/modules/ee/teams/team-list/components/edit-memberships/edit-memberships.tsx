import { getRoleManagementPermission } from "@/modules/ee/license-check/lib/utils";
import { MembersInfo } from "@/modules/ee/teams/team-list/components/edit-memberships/members-info";
import { getMembersByOrganizationId } from "@/modules/ee/teams/team-list/lib/membership";
import { getTranslations } from "next-intl/server";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getInvitesByOrganizationId } from "@formbricks/lib/invite/service";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

type EditMembershipsProps = {
  organization: TOrganization;
  currentUserId: string;
  currentUserMembership: TMembership;
  allMemberships: TMembership[];
};

export const EditMemberships = async ({
  organization,
  currentUserId,
  currentUserMembership: membership,
}: EditMembershipsProps) => {
  const members = await getMembersByOrganizationId(organization.id);
  const invites = await getInvitesByOrganizationId(organization.id);
  const t = await getTranslations();
  const currentUserRole = membership?.role;
  const isUserManagerOrOwner = membership?.role === "manager" || membership?.role === "owner";

  const canDoRoleManagement = await getRoleManagementPermission(organization);

  return (
    <div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid-cols-20 grid h-12 content-center rounded-t-lg bg-slate-100 px-4 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-5">{t("common.full_name")}</div>
          <div className="col-span-5">{t("common.email")}</div>
          {canDoRoleManagement && <div className="col-span-5">{t("common.role")}</div>}
          <div className="col-span-5"></div>
        </div>

        {currentUserRole && (
          <MembersInfo
            organization={organization}
            currentUserId={currentUserId}
            invites={invites ?? []}
            members={members ?? []}
            isUserManagerOrOwner={isUserManagerOrOwner}
            canDoRoleManagement={canDoRoleManagement}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          />
        )}
      </div>
    </div>
  );
};
