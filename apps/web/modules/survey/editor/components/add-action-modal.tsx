"use client";

import { CreateNewActionTab } from "@/modules/survey/editor/components/create-new-action-tab";
import { SavedActionsTab } from "@/modules/survey/editor/components/saved-actions-tab";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { ActionClass } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { useEffect, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface AddActionModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  environmentId: string;
  actionClasses: ActionClass[];
  setActionClasses: React.Dispatch<React.SetStateAction<ActionClass[]>>;
  isReadOnly: boolean;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
}

export const AddActionModal = ({
  open,
  setOpen,
  actionClasses,
  setActionClasses,
  localSurvey,
  setLocalSurvey,
  isReadOnly,
  environmentId,
}: AddActionModalProps) => {
  const { t } = useTranslate();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      title: t("environments.surveys.edit.select_saved_action"),
      children: (
        <SavedActionsTab
          actionClasses={actionClasses}
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          setOpen={setOpen}
        />
      ),
    },
    {
      title: t("environments.surveys.edit.capture_new_action"),
      children: (
        <CreateNewActionTab
          actionClasses={actionClasses}
          setActionClasses={setActionClasses}
          setOpen={setOpen}
          isReadOnly={isReadOnly}
          setLocalSurvey={setLocalSurvey}
          environmentId={environmentId}
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
          <DialogTitle>{t("common.add_action")}</DialogTitle>
          <DialogDescription>
            {t("environments.surveys.edit.capture_a_new_action_to_trigger_a_survey_on")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex h-full w-full items-center justify-center space-x-2 border-b border-slate-200 px-6">
            {tabs.map((tab, index) => (
              <button
                type="button"
                key={tab.title}
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
