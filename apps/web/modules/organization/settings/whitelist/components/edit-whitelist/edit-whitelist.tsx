import { WhitelistInfo } from "@/modules/organization/settings/whitelist/components/edit-whitelist/whitelist-info";
import { getWhitelistedUsers } from "@/modules/organization/settings/whitelist/lib/whitelist";
import { getTranslate } from "@/tolgee/server";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface EditWhitelistProps {
  organization: TOrganization;
  role: TOrganizationRole;
}

// Todo: add remove button, fix dropdown ui, review logic and cleanup code
export const EditWhitelist = async ({ organization, role }: EditWhitelistProps) => {
  const whitelistedUsers: TUserWhitelistInfo[] = (await getWhitelistedUsers()) ?? [];
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
            whitelistedUsers={whitelistedUsers}
            currentUserRole={role}
          />
        )}
      </div>
    </div>
  );
};
