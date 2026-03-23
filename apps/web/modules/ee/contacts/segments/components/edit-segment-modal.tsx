"use client";

import { UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment, TSegmentWithSurveyRefs } from "@formbricks/types/segment";
import { SegmentSettings } from "@/modules/ee/contacts/segments/components/segment-settings";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { SegmentActivityTab } from "./segment-activity-tab";
import { TSegmentActivitySummary } from "./segment-activity-utils";

interface EditSegmentModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  currentSegment: TSegmentWithSurveyRefs;
  activitySummary: TSegmentActivitySummary;
  segments: TSegment[];
  contactAttributeKeys: TContactAttributeKey[];
  isContactsEnabled: boolean;
  isReadOnly: boolean;
}

const SegmentSettingsTab = ({
  contactAttributeKeys,
  currentSegment,
  environmentId,
  isContactsEnabled,
  isReadOnly,
  segments,
  setOpen,
}: Pick<
  EditSegmentModalProps,
  | "contactAttributeKeys"
  | "currentSegment"
  | "environmentId"
  | "isContactsEnabled"
  | "isReadOnly"
  | "segments"
  | "setOpen"
>) => {
  if (!isContactsEnabled) {
    return null;
  }

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
};

export const EditSegmentModal = ({
  environmentId,
  open,
  setOpen,
  currentSegment,
  activitySummary,
  contactAttributeKeys,
  segments,
  isContactsEnabled,
  isReadOnly,
}: EditSegmentModalProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      title: t("common.activity"),
      children: <SegmentActivityTab currentSegment={currentSegment} activitySummary={activitySummary} />,
    },
    {
      title: t("common.settings"),
      children: (
        <SegmentSettingsTab
          contactAttributeKeys={contactAttributeKeys}
          currentSegment={currentSegment}
          environmentId={environmentId}
          isContactsEnabled={isContactsEnabled}
          isReadOnly={isReadOnly}
          segments={segments}
          setOpen={setOpen}
        />
      ),
    },
  ];

  const handleTabClick = (index: number) => {
    setActiveTab(index);
  };

  useEffect(() => {
    if (!open) {
      setActiveTab(0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent disableCloseOnOutsideClick>
        <DialogHeader>
          <UsersIcon />
          <DialogTitle>{currentSegment.title}</DialogTitle>
          <DialogDescription>{currentSegment.description ?? ""}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex h-full w-full items-center justify-center space-x-2 border-b border-slate-200 px-6">
            {tabs.map((tab, index) => (
              <button
                key={tab.title}
                className={`mr-4 px-1 pb-3 focus:outline-none ${
                  activeTab === index
                    ? "border-b-2 border-brand-dark font-semibold text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => handleTabClick(index)}>
                {tab.title}
              </button>
            ))}
          </div>
          <div className="flex-1 pt-4">{tabs[activeTab].children}</div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
