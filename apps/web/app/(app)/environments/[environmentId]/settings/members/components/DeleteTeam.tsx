"use client";

import { deleteTeamAction } from "@/app/(app)/environments/[environmentId]/settings/members/actions";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { TTeam } from "@formbricks/types/teams";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { useRouter } from "next/navigation";
import { Dispatch, SetStateAction, useState } from "react";
import toast from "react-hot-toast";

type DeleteTeamProps = {
  team: TTeam;
  isDeleteDisabled?: boolean;
  isUserOwner?: boolean;
};

export default function DeleteTeam({ team, isDeleteDisabled = false, isUserOwner = false }: DeleteTeamProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const router = useRouter();

  const handleDeleteTeam = async () => {
    setIsDeleting(true);

    try {
      await deleteTeamAction(team.id);
      toast.success("Team deleted successfully.");
      router.push("/");
    } catch (err) {
      toast.error("Error deleting team. Please try again.");
    }

    setIsDeleteDialogOpen(false);
    setIsDeleting(false);
  };

  return (
    <div>
      {!isDeleteDisabled && (
        <div>
          <p className="text-sm text-slate-900">
            This action cannot be undone. If it&apos;s gone, it&apos;s gone.
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
        teamData={team}
        deleteTeam={handleDeleteTeam}
        isDeleting={isDeleting}
      />
    </div>
  );
}

interface DeleteTeamModalProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  // teamData: { name: string; id: string; plan: string };
  teamData: TTeam;
  deleteTeam: () => void;
  isDeleting?: boolean;
}

function DeleteTeamModal({ setOpen, open, teamData, deleteTeam, isDeleting }: DeleteTeamModalProps) {
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
      disabled={inputValue !== teamData?.name}
      isDeleting={isDeleting}>
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
