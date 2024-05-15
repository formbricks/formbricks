"use client";

import {
  inviteUserAction,
  leaveTeamAction,
} from "@/app/(app)/environments/[environmentId]/settings/(team)/members/actions";
import { AddMemberModal } from "@/app/(app)/environments/[environmentId]/settings/(team)/members/components/AddMemberModal";
import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

import { TInvitee } from "@formbricks/types/invites";
import { TTeam } from "@formbricks/types/teams";
import { Button } from "@formbricks/ui/Button";
import { CreateTeamModal } from "@formbricks/ui/CreateTeamModal";
import { CustomDialog } from "@formbricks/ui/CustomDialog";

type TeamActionsProps = {
  role: string;
  isAdminOrOwner: boolean;
  isLeaveTeamDisabled: boolean;
  team: TTeam;
  isInviteDisabled: boolean;
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
  environmentId: string;
};

export const TeamActions = ({
  isAdminOrOwner,
  role,
  team,
  isLeaveTeamDisabled,
  isInviteDisabled,
  canDoRoleManagement,
  isFormbricksCloud,
  environmentId,
}: TeamActionsProps) => {
  const router = useRouter();
  const [isLeaveTeamModalOpen, setLeaveTeamModalOpen] = useState(false);
  const [isCreateTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [isAddMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLeaveTeam = async () => {
    setLoading(true);
    try {
      await leaveTeamAction(team.id);
      toast.success("You left the team successfully");
      router.refresh();
      setLoading(false);
      router.push("/");
    } catch (err) {
      toast.error(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  const handleAddMembers = async (data: TInvitee[]) => {
    try {
      await Promise.all(
        data.map(async ({ name, email, role }) => {
          await inviteUserAction(team.id, email, name, role);
        })
      );
      toast.success("Member invited successfully");
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
    router.refresh();
  };

  return (
    <>
      <div className="mb-4 text-right">
        {role !== "owner" && (
          <Button
            EndIcon={XIcon}
            variant="secondary"
            size="sm"
            className="mr-2"
            onClick={() => setLeaveTeamModalOpen(true)}>
            Leave team
          </Button>
        )}
        <Button
          variant="secondary"
          className="mr-2"
          size="sm"
          onClick={() => {
            setCreateTeamModalOpen(true);
          }}>
          Create new team
        </Button>
        {!isInviteDisabled && isAdminOrOwner && (
          <Button
            size="sm"
            variant="darkCTA"
            onClick={() => {
              setAddMemberModalOpen(true);
            }}>
            Add member
          </Button>
        )}
      </div>

      <CreateTeamModal open={isCreateTeamModalOpen} setOpen={(val) => setCreateTeamModalOpen(val)} />
      <AddMemberModal
        open={isAddMemberModalOpen}
        setOpen={setAddMemberModalOpen}
        onSubmit={handleAddMembers}
        canDoRoleManagement={canDoRoleManagement}
        isFormbricksCloud={isFormbricksCloud}
        environmentId={environmentId}
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
    </>
  );
};
