"use client";

import { UserGroupIcon } from "@heroicons/react/24/solid";

import SegmentSettingsTab from "@formbricks/ee/advancedUserTargeting/components/SegmentSettings";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TSegment } from "@formbricks/types/segment";
import ModalWithTabs from "@formbricks/ui/ModalWithTabs";

import BasicSegmentSettings from "./BasicSegmentSettings";
import SegmentActivityTab from "./SegmentActivityTab";

interface EditSegmentModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  currentSegment: TSegment & {
    activeSurveys: string[];
    inactiveSurveys: string[];
  };
  segments: TSegment[];
  attributeClasses: TAttributeClass[];
  actionClasses: TActionClass[];
  isAdvancedUserTargetingAllowed: boolean;
}

export default function EditSegmentModal({
  environmentId,
  open,
  setOpen,
  currentSegment,
  actionClasses,
  attributeClasses,
  segments,
  isAdvancedUserTargetingAllowed,
}: EditSegmentModalProps) {
  const SettingsTab = () => {
    if (isAdvancedUserTargetingAllowed) {
      return (
        <SegmentSettingsTab
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
        icon={<UserGroupIcon />}
        label={currentSegment.title}
        description={currentSegment.description || ""}
        closeOnOutsideClick={false}
      />
    </>
  );
}
