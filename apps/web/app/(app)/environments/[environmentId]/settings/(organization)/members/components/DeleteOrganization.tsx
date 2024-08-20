"use client";

import { deleteOrganizationAction } from "@/app/(app)/environments/[environmentId]/settings/(organization)/members/actions";
import { useRouter } from "next/navigation";
import { Dispatch, SetStateAction, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TOrganization } from "@formbricks/types/organizations";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { Input } from "@formbricks/ui/Input";

type DeleteOrganizationProps = {
  organization: TOrganization;
  isDeleteDisabled?: boolean;
  isUserOwner?: boolean;
  isMultiOrgEnabled: boolean;
};

export const DeleteOrganization = ({
  organization,
  isDeleteDisabled = false,
  isUserOwner = false,
}: DeleteOrganizationProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const router = useRouter();

  const handleDeleteOrganization = async () => {
    setIsDeleting(true);

    try {
      await deleteOrganizationAction({ organizationId: organization.id });
      toast.success("Organization deleted successfully.");
      router.push("/");
    } catch (err) {
      toast.error("Error deleting organization. Please try again.");
    }

    setIsDeleteDialogOpen(false);
    setIsDeleting(false);
  };

  const deleteDisabledWarning = useMemo(() => {
    if (isUserOwner)
      return "This is your only organization, it cannot be deleted. Create a new organization first.";

    return "Only Owner can delete the organization.";
  }, [isUserOwner]);

  return (
    <div>
      {!isDeleteDisabled && (
        <div>
          <p className="text-sm text-slate-900">
            This action cannot be undone. If it&apos;s gone, it&apos;s gone.
          </p>
          <Button
            size="sm"
            disabled={isDeleteDisabled}
            variant="warn"
            className={`mt-4 ${isDeleteDisabled ? "ring-grey-500 ring-1 ring-offset-1" : ""}`}
            onClick={() => setIsDeleteDialogOpen(true)}>
            Delete
          </Button>
        </div>
      )}
      {isDeleteDisabled && <p className="text-sm text-red-700">{deleteDisabledWarning}</p>}
      <DeleteOrganizationModal
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        organizationData={organization}
        deleteOrganization={handleDeleteOrganization}
        isDeleting={isDeleting}
      />
    </div>
  );
};

interface DeleteOrganizationModalProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  // organizationData: { name: string; id: string; plan: string };
  organizationData: TOrganization;
  deleteOrganization: () => void;
  isDeleting?: boolean;
}

const DeleteOrganizationModal = ({
  setOpen,
  open,
  organizationData,
  deleteOrganization,
  isDeleting,
}: DeleteOrganizationModalProps) => {
  const [inputValue, setInputValue] = useState("");

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  return (
    <DeleteDialog
      open={open}
      setOpen={setOpen}
      deleteWhat="organization"
      onDelete={deleteOrganization}
      text="Before you proceed with deleting this organization, please be aware of the following consequences:"
      disabled={inputValue !== organizationData?.name}
      isDeleting={isDeleting}>
      <div className="py-5">
        <ul className="list-disc pb-6 pl-6">
          <li>
            Permanent removal of all <b>products linked to this organization</b>. This includes all surveys,
            responses, user actions and attributes associated with these products.
          </li>
          <li>This action cannot be undone. If it&apos;s gone, it&apos;s gone.</li>
        </ul>
        <form onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="deleteOrganizationConfirmation">
            Please enter <b>{organizationData?.name}</b> in the following field to confirm the definitive
            deletion of this organization:
          </label>
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder={organizationData?.name}
            className="mt-5"
            type="text"
            id="deleteOrganizationConfirmation"
            name="deleteOrganizationConfirmation"
          />
        </form>
      </div>
    </DeleteDialog>
  );
};
