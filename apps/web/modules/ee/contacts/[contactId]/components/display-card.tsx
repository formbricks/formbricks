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
  survey: TSurvey;
  workspaceId: string;
  locale: TUserLocale;
}

export const DisplayCard = ({ display, survey, workspaceId, locale }: Readonly<DisplayCardProps>) => {
  const workspaceBasePath = `/workspaces/${workspaceId}`;
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-slate-100">
          <EyeIcon className="size-4 text-slate-600" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{t("workspace.contacts.survey_viewed")}</p>
          <Link
            href={`${workspaceBasePath}/surveys/${survey.id}/summary`}
            className="text-sm font-medium text-slate-700 hover:underline">
            {survey.name}
          </Link>
        </div>
      </div>
      <span className="text-sm text-slate-500">{timeSince(display.createdAt.toString(), locale)}</span>
    </div>
  );
};
