"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import {
  addMember,
  deleteInvite,
  removeMember,
  resendInvite,
  shareInvite,
  updateInviteeRole,
  updateMemberRole,
  useMembers,
} from "@/lib/members";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ProfileAvatar,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@formbricks/ui";
import { PaperAirplaneIcon, ShareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import toast from "react-hot-toast";
import AddMemberModal from "./AddMemberModal";
import CreateTeamModal from "@/components/team/CreateTeamModal";
import { capitalizeFirstLetter } from "@/lib/utils";
import { useProfile } from "@/lib/profile";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import ShareInviteModal from "@/app/environments/[environmentId]/settings/members/ShareInviteModal";

type EditMembershipsProps = {
  environmentId: string;
};

interface Role {
  isAdminOrOwner: boolean;
  memberRole: MembershipRole;
  teamId: string;
  memberId: string;
  environmentId: string;
  userId: string;
  memberAccepted: boolean;
  inviteId: string;
}

enum MembershipRole {
  Admin = "admin",
  Editor = "editor",
  Developer = "developer",
  Viewer = "viewer",
}

function RoleElement({
  isAdminOrOwner,
  memberRole,
  teamId,
  memberId,
  environmentId,
  userId,
  memberAccepted,
  inviteId,
}: Role) {
  const { mutateTeam } = useMembers(environmentId);
  const [loading, setLoading] = useState(false);
  const disableRole =
    memberRole && memberId && userId
      ? memberRole === ("owner" as MembershipRole) || memberId === userId
      : false;

  const handleMemberRoleUpdate = async (role: string) => {
    setLoading(true);
    if (memberAccepted) {
      await updateMemberRole(teamId, memberId, role);
    } else {
      await updateInviteeRole(teamId, inviteId, role);
    }
    setLoading(false);
    mutateTeam();
  };

  if (isAdminOrOwner) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={disableRole}
            variant="secondary"
            className="flex items-center gap-1 p-1.5 text-xs"
            loading={loading}
            size="sm">
            <span className="ml-1">{capitalizeFirstLetter(memberRole)}</span>
            <ChevronDownIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        {!disableRole && (
          <DropdownMenuContent>
            <DropdownMenuLabel className="text-center">Select Role</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={capitalizeFirstLetter(memberRole)}
              onValueChange={(value) => handleMemberRoleUpdate(value.toLowerCase())}>
              {Object.keys(MembershipRole).map((role) => (
                <DropdownMenuRadioItem key={role} value={role}>
                  {capitalizeFirstLetter(role)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    );
  }

  return <Badge text={capitalizeFirstLetter(memberRole)} type="gray" size="tiny" />;
}

export function EditMemberships({ environmentId }: EditMembershipsProps) {
  const { team, isErrorTeam, isLoadingTeam, mutateTeam } = useMembers(environmentId);

  const [isAddMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [isDeleteMemberModalOpen, setDeleteMemberModalOpen] = useState(false);
  const [isCreateTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [showShareInviteModal, setShowShareInviteModal] = useState(false);
  const [shareInviteToken, setShareInviteToken] = useState<string>("");

  const [activeMember, setActiveMember] = useState({} as any);
  const { profile } = useProfile();

  const role = team?.members?.filter((member) => member?.userId === profile?.id)[0]?.role;
  const isAdminOrOwner = role === "admin" || role === "owner";

  const handleOpenDeleteMemberModal = (e, member) => {
    e.preventDefault();
    setActiveMember(member);
    setDeleteMemberModalOpen(true);
  };

  if (isLoadingTeam) {
    return <LoadingSpinner />;
  }

  if (isErrorTeam || !team) {
    console.error(isErrorTeam);
    return <div>Error</div>;
  }

  const handleDeleteMember = async () => {
    if (activeMember.accepted) {
      await removeMember(team.teamId, activeMember.userId);
    } else {
      await deleteInvite(team.teamId, activeMember.inviteId);
    }
    setDeleteMemberModalOpen(false);
    mutateTeam();
  };

  const handleShareInvite = async (member) => {
    const { inviteToken } = await shareInvite(team.teamId, member.inviteId);
    setShareInviteToken(inviteToken);
    setShowShareInviteModal(true);
  };

  const handleResendInvite = async (inviteId) => {
    await resendInvite(team.teamId, inviteId);
  };

  const handleAddMember = async (data) => {
    // TODO: handle http 409 user is already part of the team
    await addMember(team.teamId, data);
    mutateTeam();
  };

  return (
    <>
      <div className="mb-6 text-right">
        <Button
          variant="secondary"
          className="mr-2"
          onClick={() => {
            setCreateTeamModalOpen(true);
          }}>
          Create New Team
        </Button>
        {process.env.NEXT_PUBLIC_INVITE_DISABLED !== "1" && isAdminOrOwner && (
          <Button
            variant="darkCTA"
            onClick={() => {
              setAddMemberModalOpen(true);
            }}>
            Add Member
          </Button>
        )}
      </div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid-cols-20 grid h-12 content-center rounded-t-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-2"></div>
          <div className="col-span-5">Fullname</div>
          <div className="col-span-5">Email</div>
          <div className="col-span-3">Role</div>
          <div className="col-span-5"></div>
        </div>
        <div className="grid-cols-20">
          {[...team.members, ...team.invitees].map((member) => (
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
                  teamId={team.teamId}
                  environmentId={environmentId}
                  userId={profile?.id}
                  memberAccepted={member.accepted}
                  inviteId={member?.inviteId}
                />
              </div>
              <div className="col-span-5 flex items-center justify-end gap-x-4 pr-4">
                {!member.accepted && <Badge className="mr-2" type="warning" text="Pending" size="tiny" />}
                {member.role !== "owner" && (
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
        </div>
      </div>
      <CreateTeamModal open={isCreateTeamModalOpen} setOpen={(val) => setCreateTeamModalOpen(val)} />
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
      {showShareInviteModal && (
        <ShareInviteModal
          inviteToken={shareInviteToken}
          open={showShareInviteModal}
          setOpen={setShowShareInviteModal}
        />
      )}
    </>
  );
}
