"use client";

import { TSurvey } from "@/modules/survey/list/types/surveys";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[600px]">
        <DialogHeader>
          <MousePointerClickIcon />
          <DialogTitle>{t("environments.surveys.copy_survey")}</DialogTitle>
          <DialogDescription>{t("environments.surveys.copy_survey_description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <SurveyCopyOptions
            survey={survey}
            environmentId={survey.environmentId}
            onCancel={() => setOpen(false)}
            setOpen={setOpen}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
