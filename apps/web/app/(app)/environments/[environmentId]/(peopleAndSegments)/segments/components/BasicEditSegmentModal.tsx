"use client";

import { UserGroupIcon } from "@heroicons/react/24/solid";

import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TSegment } from "@formbricks/types/segment";
import ModalWithTabs from "@formbricks/ui/ModalWithTabs";

import BasicSegmentActivityTab from "./BasicSegmentActivityTab";
import BasicSegmentsSettingsTab from "./BasicSegmentSettings";

interface BasicEditSegmentModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  currentSegment: TSegment & {
    activeSurveys: string[];
    inactiveSurveys: string[];
  };
  attributeClasses: TAttributeClass[];
}

export default function BasicEditSegmentModal({
  environmentId,
  open,
  setOpen,
  currentSegment,
  attributeClasses,
}: BasicEditSegmentModalProps) {
  const tabs = [
    {
      title: "Activity",
      children: <BasicSegmentActivityTab environmentId={environmentId} currentSegment={currentSegment} />,
    },
    {
      title: "Settings",
      children: (
        <BasicSegmentsSettingsTab
          setOpen={setOpen}
          environmentId={environmentId}
          initialSegment={currentSegment}
          attributeClasses={attributeClasses}
        />
      ),
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
