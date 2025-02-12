"use client";

import { SegmentSettings } from "@/modules/ee/contacts/segments/components/segment-settings";
import { ModalWithTabs } from "@/modules/ui/components/modal-with-tabs";
import { useTranslate } from "@tolgee/react";
import { UsersIcon } from "lucide-react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment, TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { SegmentActivityTab } from "./segment-activity-tab";

interface EditSegmentModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  currentSegment: TSegmentWithSurveyNames;
  segments: TSegment[];
  contactAttributeKeys: TContactAttributeKey[];
  isContactsEnabled: boolean;
  isReadOnly: boolean;
}

export const EditSegmentModal = ({
  environmentId,
  open,
  setOpen,
  currentSegment,
  contactAttributeKeys,
  segments,
  isContactsEnabled,
  isReadOnly,
}: EditSegmentModalProps) => {
  const { t } = useTranslate();
  const SettingsTab = () => {
    if (isContactsEnabled) {
      return (
        <SegmentSettings
          contactAttributeKeys={contactAttributeKeys}
          environmentId={environmentId}
          initialSegment={currentSegment}
          segments={segments}
          setOpen={setOpen}
          isReadOnly={isReadOnly}
        />
      );
    }

    return null;
  };

  const tabs = [
    {
      title: t("common.activity"),
      children: <SegmentActivityTab environmentId={environmentId} currentSegment={currentSegment} />,
    },
    {
      title: t("common.settings"),
      children: <SettingsTab />,
    },
  ];

  return (
    <>
      <ModalWithTabs
        open={open}
        setOpen={setOpen}
        tabs={tabs}
        icon={<UsersIcon className="h-5 w-5" />}
        label={currentSegment.title}
        description={currentSegment.description || ""}
        closeOnOutsideClick={false}
      />
    </>
  );
};
