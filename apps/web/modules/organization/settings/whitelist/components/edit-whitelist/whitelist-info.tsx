"use client";

import { WhitelistActions } from "@/modules/organization/settings/whitelist/components/edit-whitelist/whitelist-actions";
import { Badge } from "@/modules/ui/components/badge";
// import { useTranslate } from "@tolgee/react";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface WhitelistInfoProps {
  organization: TOrganization;
  whitelistedUsers: TUserWhitelistInfo[];
  currentUserRole: TOrganizationRole;
}

export const WhitelistInfo = ({ organization, currentUserRole, whitelistedUsers }: WhitelistInfoProps) => {
  const { isOwner, isManager } = getAccessFlags(currentUserRole);
  const isOwnerOrManager = isOwner || isManager;

  return (
    <div className="grid-cols-5" id="WhitelistInfoWrapper">
      {whitelistedUsers.map((user) => (
        <div
          className="singleMemberInfo grid h-auto w-full grid-cols-5 content-center rounded-lg px-4 py-3 text-left text-sm text-slate-900"
          key={user.email}>
          <div className="ph-no-capture col-span-1 flex flex-col justify-center break-all">
            <p>{user.name}</p>
          </div>
          <div className="ph-no-capture col-span-1 flex flex-col justify-center break-all text-center">
            {user.email}
          </div>

          <div className="col-span-1 flex items-center justify-center">
            <Badge type="gray" size="tiny" text={"Whitelisted"} />
          </div>
          <div className="col-span-1 flex items-center justify-end gap-x-4 pr-4">
            <WhitelistActions organization={organization} user={user} showDeleteButton={isOwnerOrManager} />
          </div>
        </div>
      ))}
    </div>
  );
};
