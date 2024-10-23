"use client";

import { SegmentSettings } from "@/modules/ee/contacts/segments/components/segment-settings";
import { UsersIcon } from "lucide-react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-keys";
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
}: EditSegmentModalProps) => {
  const SettingsTab = () => {
    if (isAdvancedTargetingAllowed) {
      return (
        <SegmentSettings
          contactAttributeKeys={contactAttributeKeys}
          environmentId={environmentId}
          initialSegment={currentSegment}
          segments={segments}
          setOpen={setOpen}
        />
      );
    }

    return null;
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
