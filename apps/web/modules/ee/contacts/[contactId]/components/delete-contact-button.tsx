"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { deleteContactAction } from "@/modules/ee/contacts/actions";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { useTranslate } from "@tolgee/react";
import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

interface DeleteContactButtonProps {
  environmentId: string;
  contactId: string;
  isReadOnly: boolean;
}

export const DeleteContactButton = ({ environmentId, contactId, isReadOnly }: DeleteContactButtonProps) => {
  const router = useRouter();
  const { t } = useTranslate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingPerson, setIsDeletingPerson] = useState(false);

  const handleDeletePerson = async () => {
    try {
      setIsDeletingPerson(true);
      const deletePersonResponse = await deleteContactAction({ contactId });

      if (deletePersonResponse?.data) {
        router.refresh();
        router.push(`/environments/${environmentId}/contacts`);
        toast.success(t("environments.contacts.contact_deleted_successfully"));
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

  if (isReadOnly) {
    return null;
  }

  return (
    <>
      <Button
        variant="destructive"
        size="icon"
        onClick={() => {
          setDeleteDialogOpen(true);
        }}>
        <TrashIcon />
      </Button>
      <DeleteDialog
        open={deleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        deleteWhat="person"
        onDelete={handleDeletePerson}
        isDeleting={isDeletingPerson}
        text={t("environments.contacts.delete_contact_confirmation")}
      />
    </>
  );
};
