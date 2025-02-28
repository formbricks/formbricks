"use client";

import { useTranslate } from "@tolgee/react";
import { Code, HelpCircle, Link2Icon } from "lucide-react";

interface SurveyTypeIndicatorProps {
  type: string;
}

export const SurveyTypeIndicator = ({ type }: SurveyTypeIndicatorProps) => {
  const { t } = useTranslate();
  const surveyTypeMapping = {
    app: { icon: Code, label: t("common.app") },
    link: { icon: Link2Icon, label: t("common.link") },
  };
  const { icon: Icon, label } = surveyTypeMapping[type] || { icon: HelpCircle, label: "Unknown" };

  return (
    <div className="flex items-center space-x-2 text-sm text-slate-600">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
};
