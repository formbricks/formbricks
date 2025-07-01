"use client";

import { SegmentSettings } from "@/modules/ee/contacts/segments/components/segment-settings";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { useTranslate } from "@tolgee/react";
import { UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [activeTab, setActiveTab] = useState(0);

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
                key={index}
                className={`mr-4 px-1 pb-3 focus:outline-none ${
                  activeTab === index
                    ? "border-brand-dark border-b-2 font-semibold text-slate-900"
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
