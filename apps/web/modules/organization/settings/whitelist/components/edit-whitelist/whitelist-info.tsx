"use client";

import { isInviteExpired } from "@/modules/organization/settings/teams/lib/utilts";
import { TInvite } from "@/modules/organization/settings/teams/types/invites";
import { WhitelistActions } from "@/modules/organization/settings/whitelist/components/edit-whitelist/whitelist-actions";
import { Badge } from "@/modules/ui/components/badge";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getFormattedDateTimeString } from "@formbricks/lib/utils/datetime";
import { TMember, TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

interface WhitelistInfoProps {
  organization: TOrganization;
  members: TMember[];
  invites: TInvite[];
  currentUserRole: TOrganizationRole;
  currentUserId: string;
}

// Type guard to check if member is an invitee
const isInvitee = (member: TMember | TInvite): member is TInvite => {
  return (member as TInvite).expiresAt !== undefined;
};

export const WhitelistInfo = ({
  organization,
  invites,
  currentUserRole,
  members,
  currentUserId,
}: WhitelistInfoProps) => {
  const allMembers = [...members, ...invites];
  const { t } = useTranslate();

  const getMembershipBadge = (member: TMember | TInvite) => {
    if (isInvitee(member)) {
      return isInviteExpired(member) ? (
        <Badge type="gray" text="Expired" size="tiny" data-testid="expired-badge" />
      ) : (
        <TooltipRenderer
          tooltipContent={`${t("environments.settings.general.invited_on", {
            date: getFormattedDateTimeString(member.createdAt),
          })}`}>
          <Badge type="warning" text="Pending" size="tiny" />
        </TooltipRenderer>
      );
    }

    return <Badge type="success" text="Active" size="tiny" />;
  };

  const { isOwner, isManager } = getAccessFlags(currentUserRole);
  const isOwnerOrManager = isOwner || isManager;

  const doesOrgHaveMoreThanOneOwner = allMembers.filter((member) => member.role === "owner").length > 1;

  const showDeleteButton = (member: TMember | TInvite) => {
    if (isInvitee(member)) {
      return isOwnerOrManager;
    }

    if (!isOwnerOrManager) {
      return false;
    }

    if (member.userId === currentUserId) {
      return false;
    }

    if (isManager) {
      return member.role !== "owner";
    }

    if (member.role === "owner") {
      return doesOrgHaveMoreThanOneOwner;
    }

    return true;
  };

  return (
    <div className="grid-cols-5" id="WhitelistInfoWrapper">
      {allMembers.map((member) => (
        <div
          className="singleMemberInfo grid h-auto w-full grid-cols-5 content-center rounded-lg px-4 py-3 text-left text-sm text-slate-900"
          key={member.email}>
          <div className="ph-no-capture col-span-1 flex flex-col justify-center break-all">
            <p>{member.name}</p>
          </div>
          <div className="ph-no-capture col-span-1 flex flex-col justify-center break-all text-center">
            {member.email}
          </div>

          <div className="col-span-1 flex items-center justify-center">{getMembershipBadge(member)}</div>
          <div className="col-span-1 flex items-center justify-end gap-x-4 pr-4">
            <WhitelistActions
              organization={organization}
              member={!isInvitee(member) ? member : undefined}
              invite={isInvitee(member) ? member : undefined}
              showDeleteButton={showDeleteButton(member)}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
