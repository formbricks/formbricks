"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { ProfileAvatar } from "@/components/ui/Avatars";
import Button from "@/components/ui/Button";
import { SendIcon } from "@/components/ui/icons/SendIcon";
import { TrashIcon } from "@/components/ui/icons/TrashIcon";
import { addMember, deleteInvite, removeMember, resendInvite, useTeam } from "@/lib/teams";
import * as Tooltip from "@/components/ui/Tooltip";
import { useState } from "react";
import AddMemberModal from "./AddMemberModal";

export function EditMembers({ environmentId }) {

  const { team, isErrorTeam, isLoadingTeam, isValidatingTeam } =
    useTeam(environmentId);

  const [isAddMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [isDeleteMemberModalOpen, setDeleteMemberModalOpen] = useState(false);

  const [activeMember, setActiveMember] = useState({} as any);

  const handleOpenDeleteMemberModal = (e, member) => {
    e.preventDefault();
    setActiveMember(member);
    setDeleteMemberModalOpen(true);
  };
  const handleDeleteMember = async () => {
    if (activeMember.accepted) {
      await removeMember(team.teamId, activeMember.userId);
    } else {
      await deleteInvite(team.teamId, activeMember.inviteId)
    }
    setDeleteMemberModalOpen(false);
  }
  const handleResendInvite = async (userId: string) => {
    await resendInvite(team.teamId, userId);
  }

  if (isLoadingTeam) {
    return <LoadingSpinner />;
  }

  if (isErrorTeam) {
    console.log(isErrorTeam)
    return <div>Error</div>;
  }

  return (
    <>
      <div className="mb-6 text-right">
        <Button
          variant="primary"
          onClick={() => {
            setAddMemberModalOpen(true);
          }}
        >
          Add Member
        </Button>
      </div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-7 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
          <div className="px-6"></div>
          <div className="col-span-2  ">Fullname</div>
          <div className="col-span-2">Email</div>
          <div className=""></div>
        </div>
        <div className="grid-cols-7">
          {[...team.members, ...team.invitees].map((member) => (
            <div className="w-full grid h-12  py-2 grid-cols-7 content-center rounded-lg text-left text-sm text-slate-900 hover:bg-slate-100" key={member.userId}>
              <div className="px-6 h-58 ">
                <ProfileAvatar userId={member.userId} />
              </div>
              <div className="col-span-2 flex flex-col justify-center"><p>{member.name}</p></div>
              <div className="col-span-2 flex flex-col justify-center">{member.email}</div>
              <div className="col-span-2 flex justify-end gap-x-6 pr-6 items-center">
                {!member.accepted && (
                  <p className="text-xs text-amber-500 bg-amber-50 border-amber-500 border-2 rounded-md px-2 py-px">Pending</p>
                )}
                <button onClick={e => handleOpenDeleteMemberModal(e, member)}>
                  <TrashIcon />
                </button>
                {!member.accepted && (
                  <Tooltip.TooltipProvider>
                    <Tooltip.Tooltip>
                      <Tooltip.TooltipTrigger asChild>
                        <button onClick={() => handleResendInvite(member.userId)}>
                          <SendIcon />
                        </button>
                      </Tooltip.TooltipTrigger>
                      <Tooltip.TooltipContent className="TooltipContent" sideOffset={5}>
                        Resend Invitation Email
                      </Tooltip.TooltipContent>
                    </Tooltip.Tooltip>
                  </Tooltip.TooltipProvider>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AddMemberModal
        teamId={team.teamId}
        open={isAddMemberModalOpen}
        setOpen={setAddMemberModalOpen}
      />
      <DeleteDialog
        open={isDeleteMemberModalOpen}
        setOpen={setDeleteMemberModalOpen}
        deleteWhat={activeMember.name + " from your team"}
        onDelete={handleDeleteMember}
      />
    </>
  );
}
