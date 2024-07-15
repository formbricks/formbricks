"use client";

import { TActionClass } from "@formbricks/types/action-classes";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ModalWithTabs } from "@formbricks/ui/ModalWithTabs";
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
  const tabs = [
    {
      title: "Select saved action",
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
      title: "Capture new action",
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
      label="Add action"
      open={open}
      setOpen={setOpen}
      tabs={tabs}
      size="md"
      closeOnOutsideClick={false}
      restrictOverflow
    />
  );
};
