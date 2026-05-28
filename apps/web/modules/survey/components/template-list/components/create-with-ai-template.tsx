"use client";

import { SparklesIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TAIUnavailableReason } from "@/modules/ee/analysis/charts/lib/ai-availability";
import { CreateWithAIDialog } from "./create-with-ai-dialog";

type CreateWithAITemplateProps = {
  workspaceId: string;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
};

export const CreateWithAITemplate = ({
  workspaceId,
  isAIAvailable,
  aiUnavailableReason,
}: CreateWithAITemplateProps) => {
  const { t } = useTranslation();

  return (
    <CreateWithAIDialog
      workspaceId={workspaceId}
      isAIAvailable={isAIAvailable}
      aiUnavailableReason={aiUnavailableReason}
      trigger={
        <button
          type="button"
          className="group relative flex flex-col rounded-lg border-2 border-dashed border-slate-300 bg-transparent p-6 transition-colors duration-150 hover:border-brand-dark">
          <SparklesIcon className="size-8 text-brand-dark transition-all duration-150 group-hover:scale-110" />
          <h3 className="text-md mb-1 mt-3 text-left font-bold text-slate-700">
            {t("workspace.surveys.ai_create.card_title")}
          </h3>
          <p className="text-left text-xs text-slate-600">
            {t("workspace.surveys.ai_create.card_description")}
          </p>
        </button>
      }
    />
  );
};
