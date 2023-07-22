"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEnvironment } from "@/lib/environments/environments";
import { useMembers } from "@/lib/members";
import { useProduct } from "@/lib/products/products";
import { useProfile } from "@/lib/profile";
import { truncate } from "@/lib/utils";
import { Button, ErrorComponent, Input } from "@formbricks/ui";
import { useTeamMutation } from "@/lib/teams/mutateTeams";
import { useTeam } from "@/lib/teams/teams";
import { useState, Dispatch, SetStateAction } from "react";
import toast from "react-hot-toast";
import { useMemberships } from "@/lib/memberships";

export default function DeleteTeam({ environmentId }) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { profile } = useProfile();
  const { memberships } = useMemberships();
  const { team } = useMembers(environmentId);
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);
  const { environment } = useEnvironment(environmentId);
  const { team: teamData } = useTeam(environmentId);

  console.log({ profile, team, product, environment, teamData, memberships });

  const availableTeams = memberships?.length;
  const role = team?.members?.filter((member) => member?.userId === profile?.id)[0]?.role;
  const isUserAdminOrOwner = role === "admin" || role === "owner";
  const isDeleteDisabled = availableTeams <= 1 || !isUserAdminOrOwner;

  if (isLoadingProduct) {
    return <LoadingSpinner />;
  }
  if (isErrorProduct) {
    return <ErrorComponent />;
  }

  //   const handleDeleteProduct = async () => {
  //     if (environment?.availableProducts?.length <= 1) {
  //       toast.error("Cannot delete product. Your team needs at least 1.");
  //       setIsDeleteDialogOpen(false);
  //       return;
  //     }
  //     const deleteProductRes = await deleteProduct(environmentId);

  //     if (deleteProductRes?.id?.length > 0) {
  //       toast.success("Product deleted successfully.");
  //       //   router.push("/");
  //     } else if (deleteProductRes?.message?.length > 0) {
  //       toast.error(deleteProductRes.message);
  //       setIsDeleteDialogOpen(false);
  //     } else {
  //       toast.error("Error deleting product. Please try again.");
  //     }
  //   };

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
          {!isUserAdminOrOwner
            ? "Only Admin or Owners can delete teams."
            : "This is your only team, it cannot be deleted. Create a new team first."}
        </p>
      )}
      <DeleteTeamModal open={isDeleteDialogOpen} setOpen={setIsDeleteDialogOpen} teamData={teamData} />
    </div>
  );
}

interface DeleteTeamModalProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  teamData: { name: string; id: string; plan: string };
}

function DeleteTeamModal({ setOpen, open, teamData }: DeleteTeamModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const deleteTeam = async () => {
    try {
      setDeleting(true);
      //   await deleteProfile();
      //   await signOut();
      //   await formbricksLogout();
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
      setOpen(false);
    }
  };

  return (
    <DeleteDialog
      open={open}
      setOpen={setOpen}
      deleteWhat="team"
      onDelete={() => deleteTeam()}
      text="Before you proceed with deleting this team, please be aware of the following consequences:"
      isDeleting={deleting}
      disabled={inputValue !== teamData.name}>
      <div className="py-5">
        <ul className="list-disc pb-6 pl-6">
          <li>
            Permanent removal of all <b>products linked to this team</b>. This includes all surveys,
            responses, user actions and attributes associated with these products.
          </li>
          <li>
            If you are the owner of a team with other admins, the ownership of that team will be transferred
            to another admin.
          </li>
          <li>
            If you are the only member of a team or there is no other admin present, the team will be
            irreversibly deleted along with all associated data.
          </li>
          <li>This action cannot be undone. If it&apos;s gone, it&apos;s gone.</li>
        </ul>
        <form>
          <label htmlFor="deleteTeamConfirmation">
            Please enter <b>{teamData.name}</b> in the following field to confirm the definitive deletion of
            this team:
          </label>
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder={teamData.name}
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
