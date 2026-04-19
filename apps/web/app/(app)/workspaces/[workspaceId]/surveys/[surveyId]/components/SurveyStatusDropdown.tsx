"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { useWorkspaceContext } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { updateSurveyAction } from "@/modules/survey/editor/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { SurveyStatusIndicator } from "@/modules/ui/components/survey-status-indicator";

interface SurveyStatusDropdownProps {
  updateLocalSurveyStatus?: (status: TSurvey["status"]) => void;
  survey: TSurvey;
}

export const SurveyStatusDropdown = ({ updateLocalSurveyStatus, survey }: SurveyStatusDropdownProps) => {
  const { workspace } = useWorkspaceContext();
  const { t } = useTranslation();
  const router = useRouter();
  const isScheduled = survey.status === "paused" && survey.publishOn !== null;

  const handleStatusChange = async (status: TSurvey["status"]) => {
    const updateSurveyActionResponse = await updateSurveyAction({ ...survey, status });

    if (updateSurveyActionResponse?.data) {
      const { publishOn, status: resultingStatus } = updateSurveyActionResponse.data;
      const isResultScheduled = resultingStatus === "paused" && publishOn !== null;
      const statusToToastMessage: Partial<Record<TSurvey["status"], string>> = {
        inProgress: t("common.survey_live"),
        paused: isResultScheduled ? t("common.survey_scheduled") : t("common.survey_paused"),
        completed: t("common.survey_completed"),
      };

      const toastMessage = statusToToastMessage[resultingStatus];
      if (toastMessage) {
        toast.success(toastMessage);
      }

      if (updateLocalSurveyStatus) {
        updateLocalSurveyStatus(resultingStatus);
      }

      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updateSurveyActionResponse);
      toast.error(errorMessage);
    }
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
          onValueChange={(value: TSurvey["status"]) => {
            handleStatusChange(value);
          }}>
          <SelectTrigger className="w-[170px] bg-white md:w-[200px]">
            <SelectValue>
              <div className="flex items-center">
                {(survey.type === "link" || workspace.appSetupCompleted) && (
                  <SurveyStatusIndicator status={survey.status} isScheduled={isScheduled} />
                )}
                <span className="ml-2 text-sm text-slate-700">
                  {survey.status === "inProgress" && t("common.in_progress")}
                  {survey.status === "paused" && (isScheduled ? t("common.scheduled") : t("common.paused"))}
                  {survey.status === "completed" && t("common.completed")}
                </span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem className="group font-normal hover:text-slate-900" value="inProgress">
              <div className="flex w-full items-center justify-center gap-4">
                <SurveyStatusIndicator status={"inProgress"} />
                {t("common.in_progress")}
              </div>
            </SelectItem>
            <SelectItem className="group font-normal hover:text-slate-900" value="paused">
              <div className="flex w-full items-center justify-center gap-2">
                <SurveyStatusIndicator status={"paused"} isScheduled={isScheduled} />
                {isScheduled ? t("common.scheduled") : t("common.paused")}
              </div>
            </SelectItem>
            <SelectItem className="group font-normal hover:text-slate-900" value="completed">
              <div className="flex w-full items-center justify-center gap-2">
                <SurveyStatusIndicator status={"completed"} />
                {t("common.completed")}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      )}
    </>
  );
};
