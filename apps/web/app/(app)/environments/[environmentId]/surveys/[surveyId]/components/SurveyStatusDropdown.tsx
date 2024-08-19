import { CheckCircle2Icon, PauseCircleIcon, PlayCircleIcon } from "lucide-react";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";
import { SurveyStatusIndicator } from "@formbricks/ui/SurveyStatusIndicator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
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
  const isCloseOnDateEnabled = survey.closeOnDate !== null;
  const closeOnDate = survey.closeOnDate ? new Date(survey.closeOnDate) : null;
  const isStatusChangeDisabled =
    (survey.status === "scheduled" || (isCloseOnDateEnabled && closeOnDate && closeOnDate < new Date())) ??
    false;

  return (
    <>
      {survey.status === "draft" ? (
        <div className="flex items-center">
          <p className="text-sm italic text-slate-600">Draft</p>
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
                <SelectTrigger className="w-[170px] bg-white py-6 md:w-[200px]">
                  <SelectValue>
                    <div className="flex items-center">
                      {(survey.type === "link" ||
                        environment.appSetupCompleted ||
                        environment.websiteSetupCompleted) && (
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
                  <PlayCircleIcon className="-mt-1 mr-1 inline h-5 w-5 text-slate-500 group-hover:text-slate-800" />
                  In-progress
                </SelectItem>
                <SelectItem className="group font-normal hover:text-slate-900" value="paused">
                  <PauseCircleIcon className="-mt-1 mr-1 inline h-5 w-5 text-slate-500 group-hover:text-slate-800" />
                  Paused
                </SelectItem>
                <SelectItem className="group font-normal hover:text-slate-900" value="completed">
                  <CheckCircle2Icon className="-mt-1 mr-1 inline h-5 w-5 text-slate-500 group-hover:text-slate-800" />
                  Completed
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
