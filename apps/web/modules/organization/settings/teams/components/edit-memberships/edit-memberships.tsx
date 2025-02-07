import { MembersInfo } from "@/modules/organization/settings/teams/components/edit-memberships/members-info";
import { getInvitesByOrganizationId } from "@/modules/organization/settings/teams/lib/invite";
import { getMembershipByOrganizationId } from "@/modules/organization/settings/teams/lib/membership";
import { getTranslate } from "@/tolgee/server";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
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
  const t = await getTranslate();

  return (
    <div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-5 content-center rounded-t-lg bg-slate-100 px-4 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-1">{t("common.full_name")}</div>
          <div className="col-span-1 text-center">{t("common.email")}</div>
          {canDoRoleManagement && <div className="col-span-1 text-center">{t("common.role")}</div>}
          <div className="col-span-1 text-center">{t("common.status")}</div>
          <div className="col-span-1"></div>
        </div>

        {role && (
          <MembersInfo
            organization={organization}
            currentUserId={currentUserId}
            invites={invites ?? []}
            members={members ?? []}
            currentUserRole={role}
            canDoRoleManagement={canDoRoleManagement}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          />
        )}
      </div>
    </div>
  );
};
