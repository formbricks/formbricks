import { MemberActions } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/components/EditMemberships/MemberActions";
import { isInviteExpired } from "@/app/lib/utils";
import { EditMembershipRole } from "@/modules/ee/role-management/components/edit-membership-role";
import { Badge } from "@/modules/ui/components/badge";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslations } from "next-intl";
import { getFormattedDateTimeString } from "@formbricks/lib/utils/datetime";
import { TInvite } from "@formbricks/types/invites";
import { TMember } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";

type MembersInfoProps = {
  organization: TOrganization;
  members: TMember[];
  invites: TInvite[];
  isUserManagerOrOwner: boolean;
  currentUserId: string;
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
};

// Type guard to check if member is an invitee
const isInvitee = (member: TMember | TInvite): member is TInvite => {
  return (member as TInvite).expiresAt !== undefined;
};

export const MembersInfo = async ({
  organization,
  invites,
  isUserManagerOrOwner,
  members,
  currentUserId,
  canDoRoleManagement,
  isFormbricksCloud,
}: MembersInfoProps) => {
  const allMembers = [...members, ...invites];
  const t = useTranslations();

  const getMembershipBadge = (member: TMember | TInvite) => {
    if (isInvitee(member)) {
      if (isInviteExpired(member)) {
        return <Badge type="gray" text="Expired" size="tiny" data-testid="badge-expired" />;
      } else {
        return (
          <TooltipRenderer
            tooltipContent={`${t("environments.settings.general.invited_on", {
              date: getFormattedDateTimeString(member.createdAt),
            })}`}>
            <Badge type="warning" text="Pending" size="tiny" data-testid="badge-pending" />
          </TooltipRenderer>
        );
      }
    }

    return <Badge type="success" text="Active" size="tiny" data-testid="badge-active" />;
  };

  const doesOrgHaveMoreThanOneOwner = allMembers.filter((member) => member.role === "owner").length > 1;

  return (
    <div className="grid-cols-5" id="membersInfoWrapper">
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

          <div className="ph-no-capture col-span-1 flex flex-col items-center justify-center break-all">
            {canDoRoleManagement && allMembers?.length > 0 && (
              <EditMembershipRole
                isUserManagerOrOwner={isUserManagerOrOwner}
                memberRole={member.role}
                memberId={!isInvitee(member) ? member.userId : ""}
                organizationId={organization.id}
                userId={currentUserId}
                memberAccepted={!isInvitee(member) ? member.accepted : undefined}
                inviteId={isInvitee(member) ? member.id : ""}
                doesOrgHaveMoreThanOneOwner={doesOrgHaveMoreThanOneOwner}
                isFormbricksCloud={isFormbricksCloud}
              />
            )}
          </div>

          <div className="col-span-1 flex items-center justify-center">{getMembershipBadge(member)}</div>
          <div className="col-span-1 flex items-center justify-end gap-x-4 pr-4">
            <MemberActions
              organization={organization}
              member={!isInvitee(member) ? member : undefined}
              invite={isInvitee(member) ? member : undefined}
              showDeleteButton={
                isUserManagerOrOwner &&
                (member as TMember).userId !== currentUserId &&
                ((member as TMember).role !== "owner" ||
                  ((member as TMember).role === "owner" && doesOrgHaveMoreThanOneOwner))
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
};
