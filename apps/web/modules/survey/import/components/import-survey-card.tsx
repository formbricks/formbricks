"use client";

import { UploadIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { ImportSurveyDialog } from "@/modules/survey/import/components/import-survey-dialog";

type ImportSurveyCardProps = {
  workspaceId: string;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
};

/** The "Import survey" card in the template grid, next to Create with AI and styled like it. */
export const ImportSurveyCard = ({
  workspaceId,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<ImportSurveyCardProps>) => {
  const { t } = useTranslation();

  return (
    <ImportSurveyDialog
      workspaceId={workspaceId}
      isAIAvailable={isAIAvailable}
      aiUnavailableReason={aiUnavailableReason}
      trigger={
        <button
          type="button"
          data-testid="import-survey-card"
          className="group relative flex flex-col rounded-lg border-2 border-dashed border-slate-300 bg-transparent p-6 transition-colors duration-150 hover:border-brand-dark">
          <UploadIcon className="size-6 text-slate-600 transition-all duration-150 group-hover:scale-110" />
          <h3 className="text-md mt-3 mb-1 text-left font-bold text-slate-700">
            {t("workspace.surveys.import.card_title")}
          </h3>
          <p className="text-left text-xs text-slate-600">{t("workspace.surveys.import.card_description")}</p>
        </button>
      }
    />
  );
};
