"use client";

import { LinkIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TContactAttributeDataType, TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { deleteContactAction } from "@/modules/ee/contacts/actions";
import { EditContactAttributesModal } from "@/modules/ee/contacts/components/edit-contact-attributes-modal";
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
  environmentId: string;
  contactId: string;
  isReadOnly: boolean;
  isQuotasAllowed: boolean;
  publishedLinkSurveys: PublishedLinkSurvey[];
  allAttributeKeys: TContactAttributeKey[];
  currentAttributes: TContactAttributeWithKeyInfo[];
}

export const ContactControlBar = ({
  environmentId,
  contactId,
  isReadOnly,
  isQuotasAllowed,
  publishedLinkSurveys,
  allAttributeKeys,
  currentAttributes,
}: ContactControlBarProps) => {
  const router = useRouter();
  const { t } = useTranslation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingPerson, setIsDeletingPerson] = useState(false);
  const [isGenerateLinkModalOpen, setIsGenerateLinkModalOpen] = useState(false);
  const [isEditAttributesModalOpen, setIsEditAttributesModalOpen] = useState(false);

  const handleDeletePerson = async () => {
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
    setIsDeletingPerson(false);
    setDeleteDialogOpen(false);
  };

  if (isReadOnly) {
    return null;
  }

  const iconActions = [
    {
      icon: PencilIcon,
      tooltip: t("environments.contacts.edit_attributes"),
      onClick: () => {
        setIsEditAttributesModalOpen(true);
      },
      isVisible: true,
    },
    {
      icon: LinkIcon,
      tooltip: t("environments.contacts.generate_personal_link"),
      onClick: () => {
        setIsGenerateLinkModalOpen(true);
      },
      isVisible: true,
    },
    {
      icon: TrashIcon,
      tooltip: t("common.delete"),
      onClick: () => {
        setDeleteDialogOpen(true);
      },
      isVisible: true,
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
            ? t("environments.contacts.delete_contact_confirmation_with_quotas", {
                value: 1,
              })
            : t("environments.contacts.delete_contact_confirmation")
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
        currentAttributes={currentAttributes}
        attributeKeys={allAttributeKeys}
      />
    </>
  );
};
