"use client";

import { deleteContactAction } from "@/app/(ee)/(contacts)/environments/[environmentId]/contacts/actions";
import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { DeleteDialog } from "@formbricks/ui/components/DeleteDialog";

interface DeletePersonButtonProps {
  environmentId: string;
  contactId: string;
  isViewer: boolean;
}

export const DeleteContactButton = ({ environmentId, contactId, isViewer }: DeletePersonButtonProps) => {
  const router = useRouter();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingPerson, setIsDeletingPerson] = useState(false);

  const handleDeletePerson = async () => {
    try {
      setIsDeletingPerson(true);
      const deletePersonResponse = await deleteContactAction({ contactId });

      if (deletePersonResponse?.data) {
        router.refresh();
        router.push(`/environments/${environmentId}/contacts`);
        toast.success("Person deleted successfully.");
      } else {
        const errorMessage = getFormattedErrorMessage(deletePersonResponse);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsDeletingPerson(false);
      setDeleteDialogOpen(false);
    }
  };

  if (isViewer) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => {
          setDeleteDialogOpen(true);
        }}>
        <TrashIcon className="h-5 w-5 text-slate-500 hover:text-red-700" />
      </button>
      <DeleteDialog
        open={deleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        deleteWhat="person"
        onDelete={handleDeletePerson}
        isDeleting={isDeletingPerson}
      />
    </>
  );
};
