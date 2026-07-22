"use client";

import { ArchiveIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TSurveyStatus } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { cn } from "@/lib/cn";
import { timeSince } from "@/lib/time";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { SurveyTypeIndicator } from "@/modules/survey/list/components/survey-type-indicator";
import { TSurveyListItem } from "@/modules/survey/list/types/survey-overview";
import { SurveyStatusIndicator } from "@/modules/ui/components/survey-status-indicator";
import { SurveyDropDownMenu } from "./survey-dropdown-menu";

interface SurveyCardProps {
  survey: TSurveyListItem;
  publicDomain: string;
  isReadOnly: boolean;
  deleteSurvey: (surveyId: string) => Promise<void>;
  updateSurveyStatus: (surveyId: string, status: TSurveyStatus) => Promise<void>;
  archiveSurvey: (surveyId: string) => Promise<void>;
  restoreSurvey: (surveyId: string) => Promise<void>;
  locale: TUserLocale;
}
export const SurveyCard = ({
  survey,
  publicDomain,
  isReadOnly,
  deleteSurvey,
  updateSurveyStatus,
  archiveSurvey,
  restoreSurvey,
  locale,
}: Readonly<SurveyCardProps>) => {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const workspaceBasePath = `/workspaces/${workspace?.id}`;
  const isArchived = survey.archivedAt !== null;
  const isScheduled = !isArchived && survey.status === "paused" && survey.publishOn !== null;
  const surveyStatusLabel = (() => {
    switch (survey.status) {
      case "inProgress":
        return t("common.in_progress");
      case "completed":
        return t("common.completed");
      case "draft":
        return t("common.draft");
      case "paused":
        return isScheduled ? t("common.scheduled") : t("common.paused");
      default:
        return undefined;
    }
  })();

  const isSurveyCreationDeletionDisabled = isReadOnly;

  const linkHref = useMemo(() => {
    // Archived surveys are read-only; always send to summary (never the editor).
    if (isArchived) {
      return `${workspaceBasePath}/surveys/${survey.id}/summary`;
    }
    return survey.status === "draft"
      ? `${workspaceBasePath}/surveys/${survey.id}/edit`
      : `${workspaceBasePath}/surveys/${survey.id}/summary`;
  }, [isArchived, survey.status, survey.id, workspaceBasePath]);

  // A read-only draft, or an archived draft (which has no summary), is not clickable.
  const isDraftAndReadOnly = survey.status === "draft" && (isReadOnly || isArchived);

  const CardBody = (
    <div
      className={cn(
        "grid w-full grid-cols-8 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-8 shadow-xs transition-colors ease-in-out",
        !isDraftAndReadOnly && "hover:border-slate-400"
      )}>
      <div className="col-span-2 flex max-w-full items-center justify-self-start text-sm font-medium text-slate-900">
        <div className="w-full truncate">{survey.name}</div>
      </div>
      <div
        className={cn(
          "col-span-1 flex w-fit items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm whitespace-nowrap text-slate-800",
          isArchived && "bg-slate-100",
          !isArchived && survey.status === "inProgress" && "bg-emerald-50",
          !isArchived && survey.status === "completed" && "bg-slate-200",
          !isArchived && survey.status === "draft" && "bg-slate-100",
          !isArchived && survey.status === "paused" && "bg-slate-100"
        )}>
        {isArchived ? (
          <>
            <div className="rounded-full bg-slate-300 p-1">
              <ArchiveIcon className="size-3 text-slate-600" />
            </div>{" "}
            {t("common.archived")}
          </>
        ) : (
          <>
            <SurveyStatusIndicator status={survey.status} isScheduled={isScheduled} />{" "}
            {surveyStatusLabel}{" "}
          </>
        )}
      </div>
      <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
        {survey.responseCount}
      </div>
      <div className="col-span-1 flex justify-between">
        <SurveyTypeIndicator type={survey.type} />
      </div>
      <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
        {formatDateForDisplay(survey.createdAt, locale)}
      </div>
      <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
        {timeSince(survey.updatedAt.toString(), locale)}
      </div>
      <div className="col-span-1 max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap text-slate-600">
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
      <div className="absolute top-3.5 right-3">
        <SurveyDropDownMenu
          survey={survey}
          key={`surveys-${survey.id}`}
          publicDomain={publicDomain}
          disabled={isDraftAndReadOnly}
          isSurveyCreationDeletionDisabled={isSurveyCreationDeletionDisabled}
          isReadOnly={isReadOnly}
          deleteSurvey={deleteSurvey}
          updateSurveyStatus={updateSurveyStatus}
          archiveSurvey={archiveSurvey}
          restoreSurvey={restoreSurvey}
        />
      </div>
    </div>
  );
};
