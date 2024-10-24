import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui/components/Select";
import { SurveyStatusIndicator } from "@formbricks/ui/components/SurveyStatusIndicator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/components/Tooltip";
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
  const t = useTranslations();
  const isCloseOnDateEnabled = survey.closeOnDate !== null;
  const closeOnDate = survey.closeOnDate ? new Date(survey.closeOnDate) : null;
  const isStatusChangeDisabled =
    (survey.status === "scheduled" || (isCloseOnDateEnabled && closeOnDate && closeOnDate < new Date())) ??
    false;

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
          onValueChange={(value) => {
            const castedValue = value as TSurvey["status"];
            updateSurveyAction({ survey: { ...survey, status: castedValue } })
              .then(() => {
                toast.success(
                  value === "inProgress"
                    ? "Survey live"
                    : value === "paused"
                      ? "Survey paused"
                      : value === "completed"
                        ? "Survey completed"
                        : ""
                );
              })
              .catch((error) => {
                toast.error(`Error: ${error.message}`);
              });

            if (updateLocalSurveyStatus) updateLocalSurveyStatus(value as TSurvey["status"]);
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
                        {survey.status === "scheduled" && "Scheduled"}
                        {survey.status === "inProgress" && "In-progress"}
                        {survey.status === "paused" && "Paused"}
                        {survey.status === "completed" && "Completed"}
                      </span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
              </TooltipTrigger>
              <SelectContent className="bg-white">
                <SelectItem className="group font-normal hover:text-slate-900" value="inProgress">
                  <div className="flex w-full items-center justify-center gap-4">
                    <SurveyStatusIndicator status={"inProgress"} />
                    In-progress
                  </div>
                </SelectItem>
                <SelectItem className="group font-normal hover:text-slate-900" value="paused">
                  <div className="flex w-full items-center justify-center gap-2">
                    <SurveyStatusIndicator status={"paused"} />
                    Paused
                  </div>
                </SelectItem>
                <SelectItem className="group font-normal hover:text-slate-900" value="completed">
                  <div className="flex w-full items-center justify-center gap-2">
                    <SurveyStatusIndicator status={"completed"} />
                    Completed
                  </div>
                </SelectItem>
              </SelectContent>

              <TooltipContent>
                To update the survey status, update the schedule and close setting in the survey response
                options.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Select>
      )}
    </>
  );
};
