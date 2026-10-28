"use client";

import {
  ArchiveIcon,
  CalendarClockIcon,
  CheckIcon,
  type LucideIcon,
  PauseIcon,
  PencilIcon,
} from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface SurveyStatusIndicatorProps {
  status: TSurvey["status"];
  isScheduled?: boolean;
  tooltip?: boolean;
}

const InProgressIndicator = () => (
  <span className="relative flex size-3">
    <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-green-500 opacity-75"></span>
    <span className="relative inline-flex size-3 rounded-full bg-green-500"></span>
  </span>
);

const IconIndicator = ({ containerClassName, Icon }: { containerClassName: string; Icon: LucideIcon }) => (
  <div className={containerClassName}>
    <Icon className="size-3 text-slate-600" />
  </div>
);

const PausedIndicator = ({ isScheduled }: { isScheduled: boolean }) => (
  <IconIndicator
    containerClassName="rounded-full bg-slate-300 p-1"
    Icon={isScheduled ? CalendarClockIcon : PauseIcon}
  />
);

const CompletedIndicator = () => (
  <IconIndicator containerClassName="rounded-full bg-slate-200 p-1" Icon={CheckIcon} />
);

const DraftIndicator = () => (
  <IconIndicator containerClassName="rounded-full bg-slate-300 p-1" Icon={PencilIcon} />
);

const DraftTooltipIndicator = () => (
  <IconIndicator containerClassName="rounded-full bg-slate-200 p-1" Icon={CheckIcon} />
);

const renderStatusIndicator = ({ isScheduled, status, tooltip }: SurveyStatusIndicatorProps): ReactNode => {
  switch (status) {
    case "inProgress":
      return <InProgressIndicator />;
    case "paused":
      return <PausedIndicator isScheduled={isScheduled ?? false} />;
    case "completed":
      return <CompletedIndicator />;
    case "draft":
      return tooltip ? <DraftTooltipIndicator /> : <DraftIndicator />;
    default:
      return null;
  }
};

const renderTooltipContent = ({
  isScheduled,
  status,
  t,
}: Pick<SurveyStatusIndicatorProps, "isScheduled" | "status"> & {
  t: ReturnType<typeof useTranslation>["t"];
}): ReactNode => {
  switch (status) {
    case "inProgress":
      return (
        <>
          <span>{t("common.gathering_responses")}</span>
          <InProgressIndicator />
        </>
      );
    case "paused":
      return (
        <>
          <span className="text-slate-800">
            {isScheduled ? t("common.survey_scheduled") : t("common.survey_paused")}
          </span>
          <PausedIndicator isScheduled={isScheduled ?? false} />
        </>
      );
    case "completed":
      return (
        <>
          <span>{t("common.survey_completed")}</span>
          <CompletedIndicator />
        </>
      );
    default:
      return null;
  }
};

export const SurveyStatusIndicator = ({
  status,
  isScheduled = false,
  tooltip,
}: SurveyStatusIndicatorProps) => {
  const { t } = useTranslation();

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>{renderStatusIndicator({ status, isScheduled, tooltip })}</TooltipTrigger>
          <TooltipContent>
            <div className="flex items-center gap-x-2">
              {renderTooltipContent({ status, isScheduled, t })}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <span>{renderStatusIndicator({ status, isScheduled, tooltip })}</span>;
};

const getSurveyStatusLabel = (
  status: TSurvey["status"],
  isScheduled: boolean,
  t: ReturnType<typeof useTranslation>["t"]
): string | undefined => {
  switch (status) {
    case "inProgress":
      return t("common.in_progress");
    case "completed":
      return t("common.closed");
    case "draft":
      return t("common.draft");
    case "paused":
      return isScheduled ? t("common.scheduled") : t("common.paused");
    default:
      return undefined;
  }
};

interface SurveyStatusPillProps {
  status: TSurvey["status"];
  isArchived?: boolean;
  isScheduled?: boolean;
  /** Replaces the status word, for lists that name a status differently (creatives say "Active"). */
  label?: string;
}

/** The status pill of the surveys list, shared by every list whose rows have a survey-like status. */
export const SurveyStatusPill = ({
  status,
  isArchived = false,
  isScheduled = false,
  label,
}: Readonly<SurveyStatusPillProps>) => {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "col-span-1 flex w-fit items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm whitespace-nowrap text-slate-800",
        isArchived && "bg-slate-100",
        !isArchived && status === "inProgress" && "bg-emerald-50",
        !isArchived && status === "completed" && "bg-slate-200",
        !isArchived && status === "draft" && "bg-slate-100",
        !isArchived && status === "paused" && "bg-slate-100"
      )}>
      {isArchived ? (
        <>
          <div className="rounded-full bg-slate-300 p-1">
            <ArchiveIcon className="size-3 text-slate-600" />
          </div>{" "}
          {label ?? t("common.archived")}
        </>
      ) : (
        <>
          <SurveyStatusIndicator status={status} isScheduled={isScheduled} />{" "}
          {label ?? getSurveyStatusLabel(status, isScheduled, t)}{" "}
        </>
      )}
    </div>
  );
};
