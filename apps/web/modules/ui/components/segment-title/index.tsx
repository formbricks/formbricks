"use client";

import { useTranslate } from "@tolgee/react";
import { UsersIcon } from "lucide-react";

interface SegmentTitleProps {
  title?: string;
  description?: string | null | undefined;
  isPrivate?: boolean;
}

export const SegmentTitle = ({ title, description, isPrivate }: SegmentTitleProps) => {
  const { t } = useTranslate();

  if (isPrivate) {
    return (
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-800">
          {t("environments.surveys.edit.send_survey_to_audience_who_match")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="rounded-full border border-slate-200 bg-white p-2">
        <UsersIcon className="h-6 w-6 text-slate-600" />
      </div>
      <div className="flex flex-col">
        <h3 className="font-medium text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
};
