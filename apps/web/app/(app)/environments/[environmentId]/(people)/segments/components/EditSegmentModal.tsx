"use client";

import { UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { SegmentSettings } from "@formbricks/ee/advanced-targeting/components/segment-settings";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSegment, TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { ModalWithTabs } from "@formbricks/ui/components/ModalWithTabs";
import { BasicSegmentSettings } from "./BasicSegmentSettings";
import { SegmentActivityTab } from "./SegmentActivityTab";

interface EditSegmentModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  currentSegment: TSegmentWithSurveyNames;
  segments: TSegment[];
  attributeClasses: TAttributeClass[];
  isAdvancedTargetingAllowed: boolean;
  isFormbricksCloud: boolean;
}

export const EditSegmentModal = ({
  environmentId,
  open,
  setOpen,
  currentSegment,
  attributeClasses,
  segments,
  isAdvancedTargetingAllowed,
  isFormbricksCloud,
}: EditSegmentModalProps) => {
  const t = useTranslations();
  const SettingsTab = () => {
    if (isAdvancedTargetingAllowed) {
      return (
        <SegmentSettings
          attributeClasses={attributeClasses}
          environmentId={environmentId}
          initialSegment={currentSegment}
          segments={segments}
          setOpen={setOpen}
        />
      );
    }

    return (
      <BasicSegmentSettings
        attributeClasses={attributeClasses}
        environmentId={environmentId}
        initialSegment={currentSegment}
        setOpen={setOpen}
        isFormbricksCloud={isFormbricksCloud}
      />
    );
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
