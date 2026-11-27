"use client";

import { LinkIcon, PencilIcon, RefreshCwIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TContactAttributeDataType, TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { EditContactAttributesModal } from "@/modules/ee/contacts/components/edit-contact-attributes-modal";
import { deleteContact } from "@/modules/ee/contacts/lib/api-client";
import { getTranslatedContactDeleteError } from "@/modules/ee/contacts/lib/contact-delete-errors";
import { PublishedLinkSurvey } from "@/modules/ee/contacts/lib/surveys";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { IconBar } from "@/modules/ui/components/iconbar";
import { GeneratePersonalLinkModal } from "./generate-personal-link-modal";

interface TContactAttributeWithKeyInfo {
  key: string;
  name: string | null;
  value: string;
  dataType: TContactAttributeDataType;
}

interface ContactControlBarProps {
  readonly contactId: string;
  readonly workspaceId: string;
  readonly isReadOnly: boolean;
  readonly isQuotasAllowed: boolean;
  /** Set when other workspaces use this directory too: the contact can't be deleted from here. */
  readonly sharedDirectoryName?: string | null;
  readonly publishedLinkSurveys: PublishedLinkSurvey[];
  readonly allAttributeKeys: TContactAttributeKey[];
  readonly currentAttributes: TContactAttributeWithKeyInfo[];
}

export const ContactControlBar = ({
  contactId,
  workspaceId,
  isReadOnly,
  isQuotasAllowed,
  sharedDirectoryName,
  publishedLinkSurveys,
  allAttributeKeys,
  currentAttributes,
}: ContactControlBarProps) => {
  const router = useRouter();
  const workspaceBasePath = `/workspaces/${workspaceId}`;
  const { t } = useTranslation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingPerson, setIsDeletingPerson] = useState(false);
  const [isGenerateLinkModalOpen, setIsGenerateLinkModalOpen] = useState(false);
  const [isEditAttributesModalOpen, setIsEditAttributesModalOpen] = useState(false);
  const [isRefreshing, startRefreshTransition] = useTransition();

  const handleRefresh = () => {
    startRefreshTransition(() => {
      router.refresh();
    });
  };

  const handleDeletePerson = async () => {
    setIsDeletingPerson(true);
    try {
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
    }
    setIsDeletingPerson(false);
    setDeleteDialogOpen(false);
  };

  const iconActions = [
    {
      icon: RefreshCwIcon,
      tooltip: t("common.refresh"),
      onClick: handleRefresh,
      isVisible: true,
      disabled: isRefreshing,
      iconClassName: isRefreshing ? "animate-spin" : undefined,
    },
    {
      icon: PencilIcon,
      tooltip: t("workspace.contacts.edit_attributes"),
      onClick: () => {
        setIsEditAttributesModalOpen(true);
      },
      isVisible: !isReadOnly,
    },
    {
      icon: LinkIcon,
      tooltip: t("workspace.contacts.generate_personal_link"),
      onClick: () => {
        setIsGenerateLinkModalOpen(true);
      },
      isVisible: !isReadOnly,
    },
    {
      icon: TrashIcon,
      tooltip: t("common.delete"),
      onClick: () => {
        setDeleteDialogOpen(true);
      },
      // Contacts of a directory other workspaces use can't be deleted: said here, before any dialog opens.
      disabledReason: sharedDirectoryName
        ? t("workspace.contacts.delete_contact_shared_directory_note", { directoryName: sharedDirectoryName })
        : undefined,
      isVisible: !isReadOnly,
    },
  ];

  return (
    <>
      <IconBar actions={iconActions} />
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
      <GeneratePersonalLinkModal
        open={isGenerateLinkModalOpen}
        setOpen={setIsGenerateLinkModalOpen}
        contactId={contactId}
        publishedLinkSurveys={publishedLinkSurveys}
      />
      <EditContactAttributesModal
        open={isEditAttributesModalOpen}
        setOpen={setIsEditAttributesModalOpen}
        contactId={contactId}
        workspaceId={workspaceId}
        currentAttributes={currentAttributes}
        attributeKeys={allAttributeKeys}
      />
    </>
  );
};
