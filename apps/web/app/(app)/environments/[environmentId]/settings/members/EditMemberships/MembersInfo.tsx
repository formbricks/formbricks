import MemberActions from "@/app/(app)/environments/[environmentId]/settings/members/EditMemberships/MemberActions";
import MembershipRole from "@/app/(app)/environments/[environmentId]/settings/members/EditMemberships/MembershipRole";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { isInviteExpired } from "@/lib/utils";
import { getInviteesByTeamId } from "@formbricks/lib/services/invite";
import {
  getAllMembershipsByUserId,
  getMembersByTeamId,
  getMembershipByUserId,
} from "@formbricks/lib/services/membership";
import { getProfile } from "@formbricks/lib/services/profile";
import { TInvite } from "@formbricks/types/v1/invites";
import { TMember } from "@formbricks/types/v1/memberships";
import { TTeam } from "@formbricks/types/v1/teams";
import { Badge, ProfileAvatar } from "@formbricks/ui";
import { getServerSession } from "next-auth";
import React from "react";

type MembersInfoProps = {
  environmentId: string;
  team: TTeam;
};

// Type guard to check if member is an invitee
function isInvitee(member: TMember | TInvite): member is TInvite {
  return (member as TInvite).expiresAt !== undefined;
}

const MembersInfo = async ({ environmentId, team }: MembersInfoProps) => {
  const members = await getMembersByTeamId(team.id);
  const invites = await getInviteesByTeamId(team.id);

  const session = await getServerSession(authOptions);

  const profile = session ? await getProfile(session.user?.id) : null;
  const membership = session ? await getMembershipByUserId(session.user?.id, team.id) : null;

  const isUserAdminOrOwner = membership?.role === "admin" || membership?.role === "owner";

  return (
    <div className="grid-cols-20">
      {[...members, ...invites].map((member) => (
        <div
          className="grid-cols-20 grid h-auto w-full content-center rounded-lg p-0.5 py-2 text-left text-sm text-slate-900"
          key={member.email}>
          <div className="h-58 col-span-2 pl-4">
            {isInvitee(member) ? (
              <ProfileAvatar userId={member.email} />
            ) : (
              <ProfileAvatar userId={member.userId} />
            )}
          </div>
          <div className="ph-no-capture col-span-5 flex flex-col justify-center break-all">
            <p>{member.name}</p>
          </div>
          <div className="ph-no-capture col-span-5  flex flex-col justify-center break-all">
            {member.email}
          </div>

          <div className="ph-no-capture col-span-3 flex flex-col items-start justify-center break-all">
            {profile && membership && (
              <MembershipRole
                isAdminOrOwner={isUserAdminOrOwner}
                memberRole={member.role}
                memberId={member.userId}
                memberName={member.name}
                teamId={team.id}
                environmentId={environmentId}
                userId={profile?.id}
                memberAccepted={member.accepted}
                inviteId={isInvitee(member) ? member.id : undefined}
                currentUserRole={membership.role}
              />
            )}
          </div>

          <div className="col-span-5 flex items-center justify-end gap-x-4 pr-4">
            {!member.accepted &&
              (isInviteExpired(member) ? (
                <Badge className="mr-2" type="gray" text="Expired" size="tiny" />
              ) : (
                <Badge className="mr-2" type="warning" text="Pending" size="tiny" />
              ))}

            <MemberActions
              team={team}
              member={!isInvitee(member) ? member : undefined}
              invite={isInvitee(member) ? member : undefined}
              isAdminOrOwner={isUserAdminOrOwner}
              showDeleteButton={
                isUserAdminOrOwner && member.role !== "owner" && member.userId !== profile?.id
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default MembersInfo;
