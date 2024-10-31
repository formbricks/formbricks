"use client";

import { useTranslations } from "next-intl";
import { TActionClass } from "@formbricks/types/action-classes";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ModalWithTabs } from "@formbricks/ui/components/ModalWithTabs";
import { CreateNewActionTab } from "./CreateNewActionTab";
import { SavedActionsTab } from "./SavedActionsTab";

interface AddActionModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  environmentId: string;
  actionClasses: TActionClass[];
  setActionClasses: React.Dispatch<React.SetStateAction<TActionClass[]>>;
  isViewer: boolean;
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
  isViewer,
  environmentId,
}: AddActionModalProps) => {
  const t = useTranslations();
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
          isViewer={isViewer}
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
