"use client";

import { useSingleUseId } from "@/modules/survey/hooks/useSingleUseId";
import { SurveyTypeIndicator } from "@/modules/survey/list/components/survey-type-indicator";
import { TSurvey } from "@/modules/survey/list/types/surveys";
import { SurveyStatusIndicator } from "@/modules/ui/components/survey-status-indicator";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { useMemo } from "react";
import { cn } from "@formbricks/lib/cn";
import { convertDateString, timeSince } from "@formbricks/lib/time";
import { SurveyDropDownMenu } from "./survey-dropdown-menu";

interface SurveyCardProps {
  survey: TSurvey;
  environmentId: string;
  isReadOnly: boolean;
  surveyDomain: string;
  duplicateSurvey: (survey: TSurvey) => void;
  deleteSurvey: (surveyId: string) => void;
}
export const SurveyCard = ({
  survey,
  environmentId,
  isReadOnly,
  surveyDomain,
  deleteSurvey,
  duplicateSurvey,
}: SurveyCardProps) => {
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

  const isSurveyCreationDeletionDisabled = isReadOnly;

  const { refreshSingleUseId } = useSingleUseId(survey);

  const linkHref = useMemo(() => {
    return survey.status === "draft"
      ? `/environments/${environmentId}/engagements/${survey.id}/edit`
      : `/environments/${environmentId}/engagements/${survey.id}/summary`;
  }, [survey.status, survey.id, environmentId]);

  const isDraftAndReadOnly = survey.status === "draft" && isReadOnly;

  const CardContent = (
    <>
      <div
        className={cn(
          "grid w-full grid-cols-8 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-8 shadow-sm transition-colors ease-in-out",
          !isDraftAndReadOnly && "hover:border-slate-400"
        )}>
        <div className="col-span-2 flex max-w-full items-center justify-self-start text-sm font-medium text-slate-900">
          <div className="w-full truncate">{survey.name}</div>
        </div>
        <div
          className={cn(
            "col-span-1 flex w-fit items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-2 text-sm text-slate-800",
            surveyStatusLabel === "Scheduled" && "bg-slate-200",
            surveyStatusLabel === "In Progress" && "bg-emerald-50",
            surveyStatusLabel === "Completed" && "bg-slate-200",
            surveyStatusLabel === "Draft" && "bg-slate-100",
            surveyStatusLabel === "Paused" && "bg-slate-100"
          )}>
          <SurveyStatusIndicator status={survey.status} /> {surveyStatusLabel}{" "}
        </div>
        <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
          {survey.responseCount}
        </div>
        <div className="col-span-1 flex justify-between">
          <SurveyTypeIndicator type={survey.type} />
        </div>
        <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
          {convertDateString(survey.createdAt.toString())}
        </div>
        <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
          {timeSince(survey.updatedAt.toString())}
        </div>
        <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
          {survey.creator ? survey.creator.name : "-"}
        </div>
      </div>
      <div className="absolute right-3 top-3.5">
        <SurveyDropDownMenu
          survey={survey}
          key={`surveys-${survey.id}`}
          environmentId={environmentId}
          surveyDomain={surveyDomain}
          disabled={isDraftAndReadOnly}
          refreshSingleUseId={refreshSingleUseId}
          isSurveyCreationDeletionDisabled={isSurveyCreationDeletionDisabled}
          duplicateSurvey={duplicateSurvey}
          deleteSurvey={deleteSurvey}
        />
      </div>
    </>
  );

  return isDraftAndReadOnly ? (
    <div className="relative block">{CardContent}</div>
  ) : (
    <Link href={linkHref} key={survey.id} className="relative block">
      {CardContent}
    </Link>
  );
};
