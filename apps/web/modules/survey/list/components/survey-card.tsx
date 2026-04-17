"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TUserLocale } from "@formbricks/types/user";
import { cn } from "@/lib/cn";
import { timeSince } from "@/lib/time";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { SurveyTypeIndicator } from "@/modules/survey/list/components/survey-type-indicator";
import { TSurveyListItem } from "@/modules/survey/list/types/survey-overview";
import { SurveyStatusIndicator } from "@/modules/ui/components/survey-status-indicator";
import { SurveyDropDownMenu } from "./survey-dropdown-menu";

interface SurveyCardProps {
  survey: TSurveyListItem;
  environmentId: string;
  publicDomain: string;
  isReadOnly: boolean;
  deleteSurvey: (surveyId: string) => Promise<void>;
  locale: TUserLocale;
}
export const SurveyCard = ({
  survey,
  environmentId,
  publicDomain,
  isReadOnly,
  deleteSurvey,
  locale,
}: SurveyCardProps) => {
  const { t } = useTranslation();
  const surveyStatusLabel = (() => {
    switch (survey.status) {
      case "inProgress":
        return t("common.in_progress");
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

  const linkHref = useMemo(() => {
    return survey.status === "draft"
      ? `/environments/${environmentId}/surveys/${survey.id}/edit`
      : `/environments/${environmentId}/surveys/${survey.id}/summary`;
  }, [survey.status, survey.id, environmentId]);

  const isDraftAndReadOnly = survey.status === "draft" && isReadOnly;

  const CardBody = (
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
          survey.status === "inProgress" && "bg-emerald-50",
          survey.status === "completed" && "bg-slate-200",
          survey.status === "draft" && "bg-slate-100",
          survey.status === "paused" && "bg-slate-100"
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
        {formatDateForDisplay(survey.createdAt, locale)}
      </div>
      <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
        {timeSince(survey.updatedAt.toString(), locale)}
      </div>
      <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
        {survey.creator ? survey.creator.name : "-"}
      </div>
    </div>
  );

  return (
    <div className="relative block">
      {isDraftAndReadOnly ? (
        CardBody
      ) : (
        <Link href={linkHref} key={survey.id} className="block">
          {CardBody}
        </Link>
      )}
      <div className="absolute right-3 top-3.5">
        <SurveyDropDownMenu
          survey={survey}
          key={`surveys-${survey.id}`}
          environmentId={environmentId}
          publicDomain={publicDomain}
          disabled={isDraftAndReadOnly}
          isSurveyCreationDeletionDisabled={isSurveyCreationDeletionDisabled}
          deleteSurvey={deleteSurvey}
        />
      </div>
    </div>
  );
};
