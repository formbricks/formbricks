"use client";

import SegmentActivityTab from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/SegmentActivityTab";
import SegmentSettingsTab from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/SegmentSettingsTab";
import ModalWithTabs from "@/components/shared/ModalWithTabs";
import { TActionClass } from "@formbricks/types/v1/actionClasses";
import { TAttributeClass } from "@formbricks/types/v1/attributeClasses";
import { TUserSegment } from "@formbricks/types/v1/userSegment";
import { UserGroupIcon } from "@heroicons/react/24/solid";

interface EditSegmentModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  currentSegment: TUserSegment & {
    activeSurveys: string[];
    inactiveSurveys: string[];
  };
  userSegments: TUserSegment[];
  attributeClasses: TAttributeClass[];
  actionClasses: TActionClass[];
}

export default function EditSegmentModal({
  environmentId,
  open,
  setOpen,
  currentSegment,
  actionClasses,
  attributeClasses,
  userSegments,
}: EditSegmentModalProps) {
  const tabs = [
    {
      title: "Activity",
      children: <SegmentActivityTab environmentId={environmentId} currentSegment={currentSegment} />,
    },
    {
      title: "Settings",
      children: (
        <SegmentSettingsTab
          setOpen={setOpen}
          environmentId={environmentId}
          initialSegment={currentSegment}
          actionClasses={actionClasses}
          attributeClasses={attributeClasses}
          userSegments={userSegments}
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
