"use client";

import { UsersIcon } from "lucide-react";
import { SegmentSettings } from "@formbricks/ee/advanced-targeting/components/segment-settings";
import { TActionClass } from "@formbricks/types/action-classes";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSegment, TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { ModalWithTabs } from "@formbricks/ui/ModalWithTabs";
import { BasicSegmentSettings } from "./BasicSegmentSettings";
import { SegmentActivityTab } from "./SegmentActivityTab";

interface EditSegmentModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  currentSegment: TSegmentWithSurveyNames;
  segments: TSegment[];
  attributeClasses: TAttributeClass[];
  actionClasses: TActionClass[];
  isAdvancedTargetingAllowed: boolean;
  isFormbricksCloud: boolean;
}

export const EditSegmentModal = ({
  environmentId,
  open,
  setOpen,
  currentSegment,
  actionClasses,
  attributeClasses,
  segments,
  isAdvancedTargetingAllowed,
  isFormbricksCloud,
}: EditSegmentModalProps) => {
  const SettingsTab = () => {
    if (isAdvancedTargetingAllowed) {
      return (
        <SegmentSettings
          actionClasses={actionClasses}
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
      title: "Activity",
      children: <SegmentActivityTab environmentId={environmentId} currentSegment={currentSegment} />,
    },
    {
      title: "Settings",
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
