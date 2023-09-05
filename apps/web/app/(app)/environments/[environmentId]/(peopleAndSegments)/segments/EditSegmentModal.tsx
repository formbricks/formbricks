"use client";

import SegmentSettingsTab from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/SegmentSettingsTab";
import ModalWithTabs from "@/components/shared/ModalWithTabs";
import { TUserSegment } from "@formbricks/types/v1/userSegment";
import { UserGroupIcon } from "@heroicons/react/24/solid";

interface EditSegmentModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  segment: TUserSegment;
}

export default function EditSegmentModal({ environmentId, open, setOpen, segment }: EditSegmentModalProps) {
  const tabs = [
    {
      title: "Activity",
      children: <div>hello</div>,
    },
    {
      title: "Settings",
      children: (
        <SegmentSettingsTab setOpen={setOpen} environmentId={environmentId} initialSegment={segment} />
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
        label={segment.title}
        description={segment.description || ""}
      />
    </>
  );
}
