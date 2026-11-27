"use client";

import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { deleteContact } from "@/modules/ee/contacts/lib/api-client";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";

interface DeleteContactButtonProps {
  readonly contactId: string;
  readonly isReadOnly: boolean;
  readonly isQuotasAllowed: boolean;
}

export const DeleteContactButton = ({ contactId, isReadOnly, isQuotasAllowed }: DeleteContactButtonProps) => {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const workspaceBasePath = `/workspaces/${workspace?.id}`;
  const { t } = useTranslation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingPerson, setIsDeletingPerson] = useState(false);

  const handleDeletePerson = async () => {
    try {
      setIsDeletingPerson(true);
      await deleteContact(contactId);
      router.refresh();
      router.push(`${workspaceBasePath}/contacts`);
      toast.success(t("workspace.contacts.contact_deleted_successfully"));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
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
