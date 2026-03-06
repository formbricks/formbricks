"use client";

import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { deleteContactAction } from "@/modules/ee/contacts/actions";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";

interface DeleteContactButtonProps {
  environmentId: string;
  contactId: string;
  isReadOnly: boolean;
  isQuotasAllowed: boolean;
}

export const DeleteContactButton = ({
  environmentId,
  contactId,
  isReadOnly,
  isQuotasAllowed,
}: DeleteContactButtonProps) => {
  const router = useRouter();
  const { t } = useTranslation();
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
        deleteWhat={t("common.person")}
        onDelete={handleDeletePerson}
        isDeleting={isDeletingPerson}
        text={
          isQuotasAllowed
            ? t("environments.contacts.delete_contact_confirmation_with_quotas", {
                value: 1,
              })
            : t("environments.contacts.delete_contact_confirmation")
        }
      />
    </>
  );
};
