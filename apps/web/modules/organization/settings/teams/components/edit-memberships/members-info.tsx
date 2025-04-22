"use client";

import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedDateTimeString } from "@/lib/utils/datetime";
import { EditMembershipRole } from "@/modules/ee/role-management/components/edit-membership-role";
import { MemberActions } from "@/modules/organization/settings/teams/components/edit-memberships/member-actions";
import { isInviteExpired } from "@/modules/organization/settings/teams/lib/utilts";
import { TInvite } from "@/modules/organization/settings/teams/types/invites";
import { Badge } from "@/modules/ui/components/badge";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { TMember, TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

interface MembersInfoProps {
  organization: TOrganization;
  members: TMember[];
  invites: TInvite[];
  currentUserRole: TOrganizationRole;
  currentUserId: string;
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
}

// Type guard to check if member is an invitee
const isInvitee = (member: TMember | TInvite): member is TInvite => {
  return (member as TInvite).expiresAt !== undefined;
};

export const MembersInfo = ({
  organization,
  invites,
  currentUserRole,
  members,
  currentUserId,
  canDoRoleManagement,
  isFormbricksCloud,
}: MembersInfoProps) => {
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

    if (!member.isActive) {
      return <Badge type="gray" text="Inactive" size="tiny" />;
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
    <div className="max-w-full space-y-4 px-4 py-3" id="membersInfoWrapper">
      {allMembers.map((member) => (
        <div
          id="singleMemberInfo"
          className="flex w-full max-w-full items-center gap-x-4 text-left text-sm text-slate-900"
          key={member.email}>
          <div className="ph-no-capture w-1/2 overflow-hidden">
            <p className="w-full truncate">{member.name}</p>
          </div>
          <div className="ph-no-capture w-1/2 overflow-hidden">
            <p className="w-full truncate"> {member.email}</p>
          </div>

          {canDoRoleManagement && allMembers?.length > 0 && (
            <div className="ph-no-capture min-w-[100px]">
              <EditMembershipRole
                currentUserRole={currentUserRole}
                memberRole={member.role}
                memberId={!isInvitee(member) ? member.userId : ""}
                organizationId={organization.id}
                userId={currentUserId}
                memberAccepted={!isInvitee(member) ? member.accepted : undefined}
                inviteId={isInvitee(member) ? member.id : ""}
                doesOrgHaveMoreThanOneOwner={doesOrgHaveMoreThanOneOwner}
                isFormbricksCloud={isFormbricksCloud}
              />
            </div>
          )}
          <div className="min-w-[80px]">{getMembershipBadge(member)}</div>

          <MemberActions
            organization={organization}
            member={!isInvitee(member) ? member : undefined}
            invite={isInvitee(member) ? member : undefined}
            showDeleteButton={showDeleteButton(member)}
          />
        </div>
      ))}
    </div>
  );
};
