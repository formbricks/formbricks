"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { addMember, deleteInvite, removeMember, resendInvite, useTeam } from "@/lib/teams";
import {
  Button,
  ProfileAvatar,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@formbricks/ui";
import { PaperAirplaneIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import AddMemberModal from "./AddMemberModal";

export function EditMemberships({ environmentId }) {
  const { team, isErrorTeam, isLoadingTeam, mutateTeam } = useTeam(environmentId);

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
      await deleteInvite(team.teamId, activeMember.inviteId);
    }
    setDeleteMemberModalOpen(false);
    mutateTeam();
  };

  const handleResendInvite = async (inviteId) => {
    await resendInvite(team.teamId, inviteId);
  };

  const handleAddMember = async (data) => {
    // TODO: handle http 409 user is already part of the team
    await addMember(team.teamId, data);
    mutateTeam();
  };

  if (isLoadingTeam) {
    return <LoadingSpinner />;
  }

  if (isErrorTeam) {
    console.error(isErrorTeam);
    return <div>Error</div>;
  }

  return (
    <>
      <div className="mb-6 text-right">
        <Button
          variant="primary"
          onClick={() => {
            setAddMemberModalOpen(true);
          }}>
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
            <div
              className="grid h-12 w-full  grid-cols-7 content-center rounded-lg py-2 text-left text-sm text-slate-900 hover:bg-slate-100"
              key={member.email}>
              <div className="h-58 px-6 ">
                <ProfileAvatar userId={member.userId} />
              </div>
              <div className="col-span-2 flex flex-col justify-center">
                <p>{member.name}</p>
              </div>
              <div className="col-span-2 flex flex-col justify-center">{member.email}</div>
              <div className="col-span-2 flex items-center justify-end gap-x-6 pr-6">
                {!member.accepted && (
                  <p className="rounded-md border-2 border-amber-500 bg-amber-50 px-2 py-px text-xs text-amber-500">
                    Pending
                  </p>
                )}
                {member.role !== "owner" && (
                  <button onClick={(e) => handleOpenDeleteMemberModal(e, member)}>
                    <TrashIcon className="h-5 w-5 text-black" />
                  </button>
                )}
                {!member.accepted && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => handleResendInvite(member.inviteId)}>
                          <PaperAirplaneIcon className="h-5 w-5 text-black" />
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
        </div>
      </div>

      <AddMemberModal
        open={isAddMemberModalOpen}
        setOpen={setAddMemberModalOpen}
        onSubmit={handleAddMember}
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
