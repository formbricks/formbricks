"use client";

import { EyeIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { TDisplay } from "@formbricks/types/displays";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { timeSince } from "@/lib/time";

interface DisplayCardProps {
  display: Pick<TDisplay, "id" | "createdAt" | "surveyId">;
  surveys: TSurvey[];
  environmentId: string;
  locale: TUserLocale;
}

export const DisplayCard = ({ display, surveys, environmentId, locale }: DisplayCardProps) => {
  const { t } = useTranslation();
  const survey = surveys.find((s) => s.id === display.surveyId);

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
          <EyeIcon className="h-4 w-4 text-slate-600" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{t("environments.contacts.survey_viewed")}</p>
          {survey ? (
            <Link
              href={`/environments/${environmentId}/surveys/${survey.id}/summary`}
              className="text-sm font-medium text-slate-700 hover:underline">
              {survey.name}
            </Link>
          ) : (
            <span className="text-sm font-medium text-slate-500">{t("common.unknown_survey")}</span>
          )}
        </div>
      </div>
      <span className="text-sm text-slate-500">{timeSince(display.createdAt.toString(), locale)}</span>
    </div>
  );
};
