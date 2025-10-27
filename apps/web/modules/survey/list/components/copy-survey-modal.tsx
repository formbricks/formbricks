"use client";

import { MousePointerClickIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@/modules/survey/list/types/surveys";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import SurveyCopyOptions from "./survey-copy-options";

interface CopySurveyModalProps {
  open: boolean;
  setOpen: (value: boolean) => void;
  survey: TSurvey;
}

export const CopySurveyModal = ({ open, setOpen, survey }: CopySurveyModalProps) => {
  const { t } = useTranslation();
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
