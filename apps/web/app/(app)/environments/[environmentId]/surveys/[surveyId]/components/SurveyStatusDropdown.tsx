"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { SurveyStatusIndicator } from "@/modules/ui/components/survey-status-indicator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { updateSurveyAction } from "../actions";

interface SurveyStatusDropdownProps {
  environment: TEnvironment;
  updateLocalSurveyStatus?: (status: TSurvey["status"]) => void;
  survey: TSurvey;
}

export const SurveyStatusDropdown = ({
  environment,
  updateLocalSurveyStatus,
  survey,
}: SurveyStatusDropdownProps) => {
  const { t } = useTranslate();
  const isCloseOnDateEnabled = survey.closeOnDate !== null;
  const closeOnDate = survey.closeOnDate ? new Date(survey.closeOnDate) : null;
  const isStatusChangeDisabled =
    (survey.status === "scheduled" || (isCloseOnDateEnabled && closeOnDate && closeOnDate < new Date())) ??
    false;

  const handleStatusChange = async (status: TSurvey["status"]) => {
    const updateSurveyActionResponse = await updateSurveyAction({ ...survey, status });

    if (updateSurveyActionResponse?.data) {
      toast.success(
        status === "inProgress"
          ? t("common.survey_live")
          : status === "paused"
            ? t("common.survey_paused")
            : status === "completed"
              ? t("common.survey_completed")
              : ""
      );
    } else {
      const errorMessage = getFormattedErrorMessage(updateSurveyActionResponse);
      toast.error(errorMessage);
    }

    if (updateLocalSurveyStatus) updateLocalSurveyStatus(status);
  };

  return (
    <>
      {survey.status === "draft" ? (
        <div className="flex items-center">
          <p className="text-sm italic text-slate-600">{t("common.draft")}</p>
        </div>
      ) : (
        <Select
          value={survey.status}
          disabled={isStatusChangeDisabled}
          onValueChange={(value: TSurvey["status"]) => {
            handleStatusChange(value);
          }}>
          <TooltipProvider delayDuration={50}>
            <Tooltip open={isStatusChangeDisabled ? undefined : false}>
              <TooltipTrigger asChild>
                <SelectTrigger className="w-[170px] bg-white md:w-[200px]">
                  <SelectValue>
                    <div className="flex items-center">
                      {(survey.type === "link" || environment.appSetupCompleted) && (
                        <SurveyStatusIndicator status={survey.status} />
                      )}
                      <span className="ml-2 text-sm text-slate-700">
                        {survey.status === "scheduled" && t("common.scheduled")}
                        {survey.status === "inProgress" && t("common.in_progress")}
                        {survey.status === "paused" && t("common.paused")}
                        {survey.status === "completed" && t("common.completed")}
                      </span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
              </TooltipTrigger>
              <SelectContent className="bg-white">
                <SelectItem className="group font-normal hover:text-slate-900" value="inProgress">
                  <div className="flex w-full items-center justify-center gap-4">
                    <SurveyStatusIndicator status={"inProgress"} />
                    {t("common.in_progress")}
                  </div>
                </SelectItem>
                <SelectItem className="group font-normal hover:text-slate-900" value="paused">
                  <div className="flex w-full items-center justify-center gap-2">
                    <SurveyStatusIndicator status={"paused"} />
                    {t("common.paused")}
                  </div>
                </SelectItem>
                <SelectItem className="group font-normal hover:text-slate-900" value="completed">
                  <div className="flex w-full items-center justify-center gap-2">
                    <SurveyStatusIndicator status={"completed"} />
                    {t("common.completed")}
                  </div>
                </SelectItem>
              </SelectContent>

              <TooltipContent>{t("environments.surveys.survey_status_tooltip")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Select>
      )}
    </>
  );
};
