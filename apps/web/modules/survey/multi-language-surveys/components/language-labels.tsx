"use client";

import { TFunction } from "i18next";
import { InfoIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Label } from "@/modules/ui/components/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

export function LanguageLabels() {
  const { t } = useTranslation();
  return (
    <div className="mb-2 grid w-full grid-cols-5 gap-4">
      <Label htmlFor="languagesId">{t("workspace.languages.language")}</Label>
      <Label htmlFor="languagesId">{t("workspace.languages.identifier")}</Label>
      <Label className="flex items-center gap-x-2" htmlFor="Alias">
        <span>{t("workspace.languages.alias")}</span>
        <LabelTooltip text={t("workspace.languages.alias_tooltip")} />
      </Label>
      <Label className="flex items-center gap-x-2">
        <span>{t("workspace.languages.default_survey_language")}</span>
        <LabelTooltip text={t("workspace.languages.default_survey_language_description")} />
      </Label>
    </div>
  );
}

function LabelTooltip({ text }: Readonly<{ text: ReturnType<TFunction> }>) {
  return (
    <TooltipProvider delayDuration={80}>
      <Tooltip>
        <TooltipTrigger tabIndex={-1}>
          <div>
            <InfoIcon className="size-4 text-slate-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
