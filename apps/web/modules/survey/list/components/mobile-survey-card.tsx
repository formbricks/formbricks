"use client";

import { useSingleUseId } from "@/modules/survey/hooks/useSingleUseId";
import { SurveyTypeIndicator } from "@/modules/survey/list/components/survey-type-indicator";
import { TSurvey } from "@/modules/survey/list/types/surveys";
import { Button } from "@/modules/ui/components/button";
import { SurveyStatusIndicator } from "@/modules/ui/components/survey-status-indicator";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { useMemo } from "react";
import { cn } from "@formbricks/lib/cn";
import { convertDateString, timeSince } from "@formbricks/lib/time";
import { SurveyDropDownMenu } from "./survey-dropdown-menu";

interface MobileSurveyCardProps {
  survey: TSurvey;
  environmentId: string;
  surveyDomain: string;
  duplicateSurvey: (survey: TSurvey) => void;
  deleteSurvey: (surveyId: string) => void;
}

export const MobileSurveyCard = ({
  survey,
  environmentId,
  surveyDomain,
  deleteSurvey,
  duplicateSurvey,
}: MobileSurveyCardProps) => {
  const { t } = useTranslate();
  const surveyStatusLabel = (() => {
    switch (survey.status) {
      case "inProgress":
        return t("common.in_progress");
      case "scheduled":
        return t("common.scheduled");
      case "completed":
        return t("common.completed");
      case "draft":
        return t("common.draft");
      case "paused":
        return t("common.paused");
      default:
        return undefined;
    }
  })();

  const { refreshSingleUseId } = useSingleUseId(survey);

  const linkHref = useMemo(() => {
    return survey.status === "draft"
      ? `/environments/${environmentId}/engagements/${survey.id}/edit`
      : `/environments/${environmentId}/engagements/${survey.id}/summary`;
  }, [survey.status, survey.id, environmentId]);

  const statusBgStyle = useMemo(() => {
    switch (survey.status) {
      case "scheduled":
        return "bg-slate-200";
      case "inProgress":
        return "bg-emerald-50";
      case "completed":
        return "bg-slate-200";
      case "draft":
        return "bg-slate-100";
      case "paused":
        return "bg-slate-100";
      default:
        return "bg-slate-100";
    }
  }, [survey.status]);

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm transition-colors ease-in-out hover:border-slate-400">
      <div className="border-b border-slate-100 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="mr-2 flex-1 truncate text-base font-medium text-slate-900">{survey.name}</h3>
          <div
            className={cn(
              "flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs",
              statusBgStyle
            )}>
            <SurveyStatusIndicator status={survey.status} /> {surveyStatusLabel}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4 text-sm">
        <div>
          <div className="mb-1 font-medium text-slate-700">{t("common.type")}</div>
          <SurveyTypeIndicator type={survey.type} />
        </div>
        <div>
          <div className="mb-1 font-medium text-slate-700">{t("common.responses")}</div>
          <div className="text-slate-700">{survey.responseCount}</div>
        </div>

        <div>
          <div className="mb-1 font-medium text-slate-700">{t("common.created_at")}</div>
          <div className="text-slate-700">{convertDateString(survey.createdAt.toString())}</div>
        </div>

        <div className="col-span-1">
          <div className="mb-1 font-medium text-slate-700">{t("common.updated_at")}</div>
          <div className="text-slate-700">{timeSince(survey.updatedAt.toString())}</div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-3">
        <Link href={linkHref}>
          <Button variant="outline" size="sm" className="">
            <span className="mr-1">{survey.status == "draft" ? t("common.edit") : t("common.summary")}</span>{" "}
          </Button>
        </Link>

        <SurveyDropDownMenu
          survey={survey}
          key={`surveys-${survey.id}`}
          environmentId={environmentId}
          surveyDomain={surveyDomain}
          refreshSingleUseId={refreshSingleUseId}
          duplicateSurvey={duplicateSurvey}
          deleteSurvey={deleteSurvey}
        />
      </div>
    </div>
  );
};
