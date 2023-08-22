"use client";

import ShareInviteModal from "@/app/(app)/environments/[environmentId]/settings/members/ShareInviteModal";
import TransferOwnershipModal from "@/app/(app)/environments/[environmentId]/settings/members/TransferOwnershipModal";
import CustomDialog from "@/components/shared/CustomDialog";
import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import CreateTeamModal from "@/components/team/CreateTeamModal";
import { env } from "@/env.mjs";
import {
  addMember,
  deleteInvite,
  removeMember,
  resendInvite,
  shareInvite,
  transferOwnership,
  updateInviteeRole,
  updateMemberRole,
  useMembers,
} from "@/lib/members";
import { useMemberships } from "@/lib/memberships";
import { useProfile } from "@/lib/profile";
import { capitalizeFirstLetter } from "@/lib/utils";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  ProfileAvatar,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@formbricks/ui";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { PaperAirplaneIcon, ShareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import AddMemberModal from "./AddMemberModal";

type EditMembershipsProps = {
  environmentId: string;
};

interface Role {
  isAdminOrOwner: boolean;
  memberRole: MembershipRole;
  teamId: string;
  memberId: string;
  memberName: string;
  environmentId: string;
  userId: string;
  memberAccepted: boolean;
  inviteId: string;
  currentUserRole: string;
}

enum MembershipRole {
  Owner = "owner",
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
  memberName,
  environmentId,
  userId,
  memberAccepted,
  inviteId,
  currentUserRole,
}: Role) {
  const { mutateTeam } = useMembers(environmentId);
  const [loading, setLoading] = useState(false);
  const [isTransferOwnershipModalOpen, setTransferOwnershipModalOpen] = useState(false);
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

  const handleOwnershipTransfer = async () => {
    setLoading(true);
    const isTransfered = await transferOwnership(teamId, memberId);
    if (isTransfered) {
      toast.success("Ownership transferred successfully");
    } else {
      toast.error("Something went wrong");
    }
    setTransferOwnershipModalOpen(false);
    setLoading(false);
    mutateTeam();
  };

  const handleRoleChange = (role: string) => {
    if (role === "owner") {
      setTransferOwnershipModalOpen(true);
    } else {
      handleMemberRoleUpdate(role);
    }
  };

  const getMembershipRoles = () => {
    if (currentUserRole === "owner" && memberAccepted) {
      return Object.keys(MembershipRole);
    }
    return Object.keys(MembershipRole).filter((role) => role !== "Owner");
  };

  if (isAdminOrOwner) {
    return (
      <>
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
              <DropdownMenuRadioGroup
                value={capitalizeFirstLetter(memberRole)}
                onValueChange={(value) => handleRoleChange(value.toLowerCase())}>
                {getMembershipRoles().map((role) => (
                  <DropdownMenuRadioItem key={role} value={role}>
                    {capitalizeFirstLetter(role)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          )}
        </DropdownMenu>
        <TransferOwnershipModal
          open={isTransferOwnershipModalOpen}
          setOpen={setTransferOwnershipModalOpen}
          memberName={memberName}
          onSubmit={handleOwnershipTransfer}
          isLoading={loading}
        />
      </>
    );
  }

  return <Badge text={capitalizeFirstLetter(memberRole)} type="gray" size="tiny" />;
}

export function EditMemberships({ environmentId }: EditMembershipsProps) {
  const { team, isErrorTeam, isLoadingTeam, mutateTeam } = useMembers(environmentId);

  const [loading, setLoading] = useState(false);
  const [isAddMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [isDeleteMemberModalOpen, setDeleteMemberModalOpen] = useState(false);
  const [isCreateTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [showShareInviteModal, setShowShareInviteModal] = useState(false);
  const [isLeaveTeamModalOpen, setLeaveTeamModalOpen] = useState(false);
  const [shareInviteToken, setShareInviteToken] = useState<string>("");

  const [activeMember, setActiveMember] = useState({} as any);
  const { profile } = useProfile();
  const { memberships } = useMemberships();

  const router = useRouter();

  const role = team?.members?.filter((member) => member?.userId === profile?.id)[0]?.role;
  const isAdminOrOwner = role === "admin" || role === "owner";

  const availableTeams = memberships?.length;
  const isLeaveTeamDisabled = availableTeams <= 1;

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
    let result = false;
    if (activeMember.accepted) {
      result = await removeMember(team.teamId, activeMember.userId);
    } else {
      result = await deleteInvite(team.teamId, activeMember.inviteId);
    }
    if (result) {
      toast.success("Member removed successfully");
    } else {
      toast.error("Something went wrong");
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
    const add = await addMember(team.teamId, data);
    if (add) {
      toast.success("Member invited successfully");
    } else {
      toast.error("Something went wrong");
    }
    mutateTeam();
  };

  const isExpired = (invite) => {
    const now = new Date();
    const expiresAt = new Date(invite.expiresAt);
    return now > expiresAt;
  };

  const handleLeaveTeam = async () => {
    setLoading(true);
    const result = await removeMember(team.teamId, profile?.id);
    setLeaveTeamModalOpen(false);
    setLoading(false);
    if (!result) {
      toast.error("Something went wrong");
    } else {
      toast.success("You left the team successfully");
      router.push("/");
    }
  };

  return (
    <>
      <div className="mb-6 text-right">
        {role !== "owner" && (
          <Button variant="minimal" className="mr-2" onClick={() => setLeaveTeamModalOpen(true)}>
            Leave Team
          </Button>
        )}
        <Button
          variant="secondary"
          className="mr-2 hidden sm:inline-flex"
          onClick={() => {
            setCreateTeamModalOpen(true);
          }}>
          Create New Team
        </Button>
        {env.NEXT_PUBLIC_INVITE_DISABLED !== "1" && isAdminOrOwner && (
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
          <div className="hidden sm:col-span-3 sm:block">Role</div>
          <div className="hidden sm:col-span-5 sm:block"></div>
        </div>
        <div className="grid-cols-20">
          {[...team.members, ...team.invitees].map((member) => (
            <div
              className="grid-cols-20 grid h-auto w-full content-center rounded-lg p-0.5 py-2 text-left text-sm text-slate-900"
              key={member.email}>
              <div className="h-58 col-span-2  pl-4 ">
                <div className="hidden sm:block">
                  <ProfileAvatar userId={member.userId || member.email} />
                </div>
              </div>
              <div className="ph-no-capture col-span-5 flex flex-col justify-center break-all">
                <p>{member.name}</p>
              </div>
              <div className="ph-no-capture col-span-5 flex flex-col justify-center break-all">
                {member.email}
              </div>
              <div className="ph-no-capture col-span-3 hidden flex-col items-start justify-center break-all sm:flex">
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
              <div className="col-span-5 ml-48 hidden items-center justify-end gap-x-2 pr-4 sm:ml-0 sm:gap-x-4 lg:flex">
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

      <CustomDialog
        open={isLeaveTeamModalOpen}
        setOpen={setLeaveTeamModalOpen}
        title="Are you sure?"
        text="You wil leave this team and loose access to all surveys and responses. You can only rejoin if you are invited again."
        onOk={handleLeaveTeam}
        okBtnText="Yes, leave team"
        disabled={isLeaveTeamDisabled}
        isLoading={loading}>
        {isLeaveTeamDisabled && (
          <p className="mt-2 text-sm text-red-700">
            You cannot leave this team as it is your only team. Create a new team first.
          </p>
        )}
      </CustomDialog>

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
