"use client";

import { CreateNewActionTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/CreateNewActionTab";
import { SavedActionsTab } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/SavedActionsTab";

import { TActionClass } from "@formbricks/types/actionClasses";
import { TSurvey } from "@formbricks/types/surveys";
import { ModalWithTabs } from "@formbricks/ui/ModalWithTabs";

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
    />
  );
};
