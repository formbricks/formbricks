"use client";

import { CalendarClockIcon, CheckIcon, PauseIcon, PencilIcon } from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface SurveyStatusIndicatorProps {
  status: TSurvey["status"];
  isScheduled?: boolean;
  tooltip?: boolean;
}

const InProgressIndicator = () => (
  <span className="relative flex h-3 w-3">
    <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-green-500 opacity-75"></span>
    <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
  </span>
);

const PausedIndicator = ({ isScheduled }: { isScheduled: boolean }) => (
  <div className="rounded-full bg-slate-300 p-1">
    {isScheduled ? (
      <CalendarClockIcon className="h-3 w-3 text-slate-600" />
    ) : (
      <PauseIcon className="h-3 w-3 text-slate-600" />
    )}
  </div>
);

const CompletedIndicator = () => (
  <div className="rounded-full bg-slate-200 p-1">
    <CheckIcon className="h-3 w-3 text-slate-600" />
  </div>
);

const DraftIndicator = () => (
  <div className="rounded-full bg-slate-300 p-1">
    <PencilIcon className="h-3 w-3 text-slate-600" />
  </div>
);

const DraftTooltipIndicator = () => (
  <div className="rounded-full bg-slate-200 p-1">
    <CheckIcon className="h-3 w-3 text-slate-600" />
  </div>
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
            <div className="flex items-center space-x-2">
              {renderTooltipContent({ status, isScheduled, t })}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <span>{renderStatusIndicator({ status, isScheduled, tooltip })}</span>;
};
