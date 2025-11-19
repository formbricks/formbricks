"use client";

import { useTranslation } from "react-i18next";

interface EmptyQuestionStateProps {
  className?: string;
}

export const EmptyQuestionState = ({ className }: EmptyQuestionStateProps) => {
  const { t } = useTranslation();

  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 p-8 text-center ${className || ""}`}>
      <p className="text-sm text-slate-500">{t("environments.surveys.summary.no_responses_found")}</p>
    </div>
  );
};

