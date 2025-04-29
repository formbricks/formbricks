import { getInvitesByOrganizationId } from "@/modules/organization/settings/teams/lib/invite";
import { getEditMembershipByOrganizationId } from "@/modules/organization/settings/teams/lib/membership";
import { WhitelistInfo } from "@/modules/organization/settings/whitelist/components/edit-whitelist/whitelist-info";
import { getTranslate } from "@/tolgee/server";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

interface EditWhitelistProps {
  organization: TOrganization;
  currentUserId: string;
  role: TOrganizationRole;
}

export const EditWhitelist = async ({ organization, currentUserId, role }: EditWhitelistProps) => {
  const members = await getEditMembershipByOrganizationId(organization.id);
  const invites = await getInvitesByOrganizationId(organization.id);
  const t = await getTranslate();

  return (
    <div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-5 content-center rounded-t-lg bg-slate-100 px-4 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-1">{t("common.full_name")}</div>
          <div className="col-span-1 text-center">{t("common.email")}</div>
          <div className="col-span-1 text-center">{t("common.status")}</div>
          <div className="col-span-1"></div>
        </div>

        {role && (
          <WhitelistInfo
            organization={organization}
            currentUserId={currentUserId}
            invites={invites ?? []}
            members={members ?? []}
            currentUserRole={role}
          />
        )}
      </div>
    </div>
  );
};
