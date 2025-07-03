"use client";

import { TSurvey } from "@/modules/survey/list/types/surveys";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import { MousePointerClickIcon } from "lucide-react";
import SurveyCopyOptions from "./survey-copy-options";

interface CopySurveyModalProps {
  open: boolean;
  setOpen: (value: boolean) => void;
  survey: TSurvey;
}

export const CopySurveyModal = ({ open, setOpen, survey }: CopySurveyModalProps) => {
  const { t } = useTranslate();
  return (
    <Modal open={open} setOpen={setOpen} noPadding restrictOverflow>
      <div className="flex h-full flex-col rounded-lg">
        <div className="fixed left-0 right-0 z-10 h-24 rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <MousePointerClickIcon className="h-6 w-6 text-slate-500" />
              <div>
                <div className="text-xl font-medium text-slate-700">
                  {t("environments.surveys.copy_survey")}
                </div>
                <div className="text-sm text-slate-500">
                  {t("environments.surveys.copy_survey_description")}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="h-full max-h-[500px] overflow-auto pl-4 pt-24">
          <SurveyCopyOptions
            survey={survey}
            environmentId={survey.environmentId}
            onCancel={() => setOpen(false)}
            setOpen={setOpen}
          />
        </div>
      </div>
    </Modal>
  );
};
