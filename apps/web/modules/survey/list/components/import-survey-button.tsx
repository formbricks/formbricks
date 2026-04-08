"use client";

import { UploadIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { ImportSurveyModal } from "./import-survey-modal";

interface ImportSurveyButtonProps {
  environmentId: string;
}

export const ImportSurveyButton = ({ environmentId }: ImportSurveyButtonProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <UploadIcon className="mr-2 h-4 w-4" />
        {t("environments.surveys.import_survey")}
      </Button>
      <ImportSurveyModal environmentId={environmentId} open={open} setOpen={setOpen} />
    </>
  );
};
