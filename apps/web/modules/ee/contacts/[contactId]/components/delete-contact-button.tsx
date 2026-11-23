"use client";

import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { deleteContactAction } from "@/modules/ee/contacts/actions";
import { getTranslatedContactDeleteError } from "@/modules/ee/contacts/lib/contact-delete-errors";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";

interface DeleteContactButtonProps {
  readonly contactId: string;
  readonly workspaceId: string;
  readonly isReadOnly: boolean;
  readonly isQuotasAllowed: boolean;
}

export const DeleteContactButton = ({
  contactId,
  workspaceId,
  isReadOnly,
  isQuotasAllowed,
}: DeleteContactButtonProps) => {
  const router = useRouter();
  const workspaceBasePath = `/workspaces/${workspaceId}`;
  const { t } = useTranslation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingPerson, setIsDeletingPerson] = useState(false);

  const handleDeletePerson = async () => {
    try {
      setIsDeletingPerson(true);
      const deletePersonResponse = await deleteContactAction({ contactId, workspaceId });

      if (deletePersonResponse?.data) {
        router.refresh();
        router.push(`${workspaceBasePath}/contacts`);
        toast.success(t("workspace.contacts.contact_deleted_successfully"));
      } else {
        toast.error(getTranslatedContactDeleteError(getFormattedErrorMessage(deletePersonResponse), t));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unknown error occurred");
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
            ? t("workspace.contacts.delete_contact_confirmation_with_quotas", {
                value: 1,
              })
            : t("workspace.contacts.delete_contact_confirmation")
        }
      />
    </>
  );
};
