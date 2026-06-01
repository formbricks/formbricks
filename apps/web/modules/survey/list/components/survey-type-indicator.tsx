"use client";

import { Code, HelpCircle, Link2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SurveyTypeIndicatorProps {
  type: string;
}

export const SurveyTypeIndicator = ({ type }: SurveyTypeIndicatorProps) => {
  const { t } = useTranslation();
  const surveyTypeMapping = {
    app: { icon: Code, label: t("common.app") },
    link: { icon: Link2Icon, label: t("common.link") },
  };
  const { icon: Icon, label } = (surveyTypeMapping as Record<string, { icon: typeof Code; label: string }>)[
    type
  ] || { icon: HelpCircle, label: "Unknown" };

  return (
    <div className="flex items-center gap-x-2 text-sm text-slate-600">
      <Icon className="size-4" />
      <span>{label}</span>
    </div>
  );
};
