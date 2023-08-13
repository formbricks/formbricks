import { TTeam } from "@formbricks/types/v1/teams";
import {
  getAllMembershipsByUserId,
  getMembersByTeamId,
  getMembershipByUserId,
} from "@formbricks/lib/services/membership";
import { getInviteesByTeamId } from "@formbricks/lib/services/invite";
import React, { Suspense } from "react";
import { getProfile } from "@formbricks/lib/services/profile";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import MembersInfo from "@/app/(app)/environments/[environmentId]/settings/members/EditMemberships/MembersInfo";

type EditMembershipsProps = {
  environmentId: string;
  team: TTeam;
};

export async function EditMemberships({ environmentId, team }: EditMembershipsProps) {
  const session = await getServerSession(authOptions);
  // const membership = session ? await getMembershipByUserId(session.user?.id, team.id) : null;
  // const allMemberships = session ? await getAllMembershipsByUserId(session.user?.id) : null;

  return (
    <div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid-cols-20 grid h-12 content-center rounded-t-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-2"></div>
          <div className="col-span-5">Fullname</div>
          <div className="col-span-5">Email</div>
          <div className="col-span-3">Role</div>
          <div className="col-span-5"></div>
        </div>

        <MembersInfo environmentId={environmentId} team={team} />

        {/* <div className="grid-cols-20">
          {[...members, ...invites].map((member) => (
            <div
              className="grid-cols-20 grid h-auto w-full content-center rounded-lg p-0.5 py-2 text-left text-sm text-slate-900"
              key={member.email}>
              <div className="h-58 col-span-2 pl-4">
                <ProfileAvatar userId={member.userId || member.email} />
              </div>
              <div className="ph-no-capture col-span-5 flex flex-col justify-center break-all">
                <p>{member.name}</p>
              </div>
              <div className="ph-no-capture col-span-5  flex flex-col justify-center break-all">
                {member.email}
              </div>
              <div className="ph-no-capture col-span-3 flex flex-col items-start justify-center break-all">
                <RoleElement
                  isAdminOrOwner={isAdminOrOwner}
                  memberRole={member.role}
                  memberId={member.userId}
                  memberName={member.name}
                  teamId={team.teamId}
                  environmentId={environmentId}
                  userId={profile?.id}
                  memberAccepted={member.accepted}
                  inviteId={member?.inviteId}
                  currentUserRole={role}
                />
              </div>
              <div className="col-span-5 flex items-center justify-end gap-x-4 pr-4">
                {!member.accepted &&
                  (isExpired(member) ? (
                    <Badge className="mr-2" type="gray" text="Expired" size="tiny" />
                  ) : (
                    <Badge className="mr-2" type="warning" text="Pending" size="tiny" />
                  ))}
                {isAdminOrOwner && member.role !== "owner" && member.userId !== profile?.id && (
                  <button onClick={(e) => handleOpenDeleteMemberModal(e, member)}>
                    <TrashIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
                  </button>
                )}

                {!member.accepted && (
                  <TooltipProvider delayDuration={50}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            handleShareInvite(member);
                          }}>
                          <ShareIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="TooltipContent" sideOffset={5}>
                        Share Invite Link
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            handleResendInvite(member.inviteId);
                            toast.success("Invitation sent once more.");
                          }}>
                          <PaperAirplaneIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="TooltipContent" sideOffset={5}>
                        Resend Invitation Email
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          ))}
        </div> */}
      </div>
    </div>
  );
}
