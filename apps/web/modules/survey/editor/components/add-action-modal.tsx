"use client";

import { CreateNewActionTab } from "@/modules/survey/editor/components/create-new-action-tab";
import { SavedActionsTab } from "@/modules/survey/editor/components/saved-actions-tab";
import { ModalWithTabs } from "@/modules/ui/components/modal-with-tabs";
import { ActionClass } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
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
  return (
    <ModalWithTabs
      label={t("common.add_action")}
      description={t("environments.surveys.edit.capture_a_new_action_to_trigger_a_survey_on")}
      open={open}
      setOpen={setOpen}
      tabs={tabs}
      size="md"
      closeOnOutsideClick={false}
      restrictOverflow
    />
  );
};
