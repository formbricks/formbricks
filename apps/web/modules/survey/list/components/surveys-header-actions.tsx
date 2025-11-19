"use client";

import { PlusIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { ImportSurveyModal } from "./import-survey-modal";

interface SurveysHeaderActionsProps {
  environmentId: string;
}

export const SurveysHeaderActions = ({ environmentId }: SurveysHeaderActionsProps) => {
  const { t } = useTranslation();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setIsImportModalOpen(true)}>
          <UploadIcon className="h-4 w-4" />
          {t("environments.surveys.import_survey")}
        </Button>
        <Button size="sm" asChild>
          <Link href={`/environments/${environmentId}/surveys/templates`}>
            {t("environments.surveys.new_survey")}
            <PlusIcon className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <ImportSurveyModal
        environmentId={environmentId}
        open={isImportModalOpen}
        setOpen={setIsImportModalOpen}
      />
    </>
  );
};
