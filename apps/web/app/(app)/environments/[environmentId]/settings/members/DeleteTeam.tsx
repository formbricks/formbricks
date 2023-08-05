"use client";

import toast from "react-hot-toast";
import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useState, Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { useMembers } from "@/lib/members";
import { useProfile } from "@/lib/profile";
import { truncate } from "@/lib/utils";
import { Button, ErrorComponent, Input } from "@formbricks/ui";
import { useTeam, deleteTeam } from "@/lib/teams/teams";
import { useMemberships } from "@/lib/memberships";

export default function DeleteTeam({ environmentId }) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const router = useRouter();
  const { profile } = useProfile();
  const { memberships } = useMemberships();
  const { team, isErrorTeam: isErrorTeamMembers } = useMembers(environmentId);
  const { team: teamData, isLoadingTeam, isErrorTeam } = useTeam(environmentId);

  const availableTeams = memberships?.length;
  const role = team?.members?.filter((member) => member?.userId === profile?.id)[0]?.role;
  const isUserOwner = role === "owner";
  const isDeleteDisabled = availableTeams <= 1 || !isUserOwner;

  if (isLoadingTeam) {
    return <LoadingSpinner />;
  }
  if (isErrorTeam) {
    return <ErrorComponent />;
  }

  const handleDeleteTeam = async () => {
    if (memberships?.length <= 1) {
      toast.error("Cannot delete team. You need at least 1.");
      setIsDeleteDialogOpen(false);
      return;
    }
    const deleteTeamRes = await deleteTeam(environmentId);

    if (deleteTeamRes?.deletedTeam?.id?.length > 0) {
      toast.success("Team deleted successfully.");
      router.push("/");
    } else if (deleteTeamRes?.message?.length > 0) {
      toast.error(deleteTeamRes.message);
      setIsDeleteDialogOpen(false);
    } else {
      toast.error("Error deleting team. Please try again.");
    }
  };

  return (
    <div>
      {!isDeleteDisabled && (
        <div>
          <p className="text-sm text-slate-900">
            Delete <b>{truncate(teamData?.name, 30)}</b>
            &nbsp;with all its products incl. all surveys, responses, people, actions and attributes.{" "}
            <strong>This action cannot be undone.</strong>
          </p>
          <Button
            disabled={isDeleteDisabled}
            variant="warn"
            className={`mt-4 ${isDeleteDisabled ? "ring-grey-500 ring-1 ring-offset-1" : ""}`}
            onClick={() => setIsDeleteDialogOpen(true)}>
            Delete
          </Button>
        </div>
      )}
      {isDeleteDisabled && (
        <p className="text-sm text-red-700">
          {!isUserOwner
            ? "Only Owner can delete the team."
            : "This is your only team, it cannot be deleted. Create a new team first."}
        </p>
      )}
      <DeleteTeamModal
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        teamData={teamData}
        deleteTeam={handleDeleteTeam}
      />
    </div>
  );
}

interface DeleteTeamModalProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  teamData: { name: string; id: string; plan: string };
  deleteTeam: () => void;
}

function DeleteTeamModal({ setOpen, open, teamData, deleteTeam }: DeleteTeamModalProps) {
  const [inputValue, setInputValue] = useState("");

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  return (
    <DeleteDialog
      open={open}
      setOpen={setOpen}
      deleteWhat="team"
      onDelete={deleteTeam}
      text="Before you proceed with deleting this team, please be aware of the following consequences:"
      disabled={inputValue !== teamData?.name}>
      <div className="py-5">
        <ul className="list-disc pb-6 pl-6">
          <li>
            Permanent removal of all <b>products linked to this team</b>. This includes all surveys,
            responses, user actions and attributes associated with these products.
          </li>
          <li>This action cannot be undone. If it&apos;s gone, it&apos;s gone.</li>
        </ul>
        <form>
          <label htmlFor="deleteTeamConfirmation">
            Please enter <b>{teamData?.name}</b> in the following field to confirm the definitive deletion of
            this team:
          </label>
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder={teamData?.name}
            className="mt-5"
            type="text"
            id="deleteTeamConfirmation"
            name="deleteTeamConfirmation"
          />
        </form>
      </div>
    </DeleteDialog>
  );
}
