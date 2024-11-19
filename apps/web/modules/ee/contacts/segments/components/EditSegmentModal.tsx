"use client";

import { SegmentSettings } from "@/modules/ee/contacts/segments/components/segment-settings";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { TSegment, TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { ModalWithTabs } from "@formbricks/ui/components/ModalWithTabs";
import { SegmentActivityTab } from "./SegmentActivityTab";

interface EditSegmentModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  currentSegment: TSegmentWithSurveyNames;
  segments: TSegment[];
  contactAttributeKeys: TContactAttributeKey[];
  isAdvancedTargetingAllowed: boolean;
  isFormbricksCloud: boolean;
  isReadOnly: boolean;
}

export const EditSegmentModal = ({
  environmentId,
  open,
  setOpen,
  currentSegment,
  contactAttributeKeys,
  segments,
  isAdvancedTargetingAllowed,
  isFormbricksCloud,
  isReadOnly,
}: EditSegmentModalProps) => {
  const t = useTranslations();
  const SettingsTab = () => {
    if (isAdvancedTargetingAllowed || false) {
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
