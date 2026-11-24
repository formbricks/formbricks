"use client";

import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { deleteContact } from "@/modules/ee/contacts/lib/api-client";
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
      await deleteContact(contactId, workspaceId);
      router.refresh();
      router.push(`${workspaceBasePath}/contacts`);
      toast.success(t("workspace.contacts.contact_deleted_successfully"));
    } catch (error) {
      toast.error(
        getTranslatedContactDeleteError(
          getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")),
          t
        )
      );
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
