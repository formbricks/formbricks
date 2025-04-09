"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { CheckCircle2Icon, ChevronsDownIcon, XCircleIcon } from "lucide-react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { parseRecallInfo } from "@formbricks/lib/utils/recall";
import { TResponseData } from "@formbricks/types/responses";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";

interface QuestionSkipProps {
  skippedQuestions: string[] | undefined;
  status: string;
  questions: TSurveyQuestion[];
  isFirstQuestionAnswered?: boolean;
  responseData: TResponseData;
}

export const QuestionSkip = ({
  skippedQuestions,
  status,
  questions,
  isFirstQuestionAnswered,
  responseData,
}: QuestionSkipProps) => {
  const { t } = useTranslate();
  return (
    <div>
      {skippedQuestions && (
        <div className="my-2 flex w-full px-2 text-sm text-slate-400">
          {status === "welcomeCard" && (
            <div className="mb-2 flex">
              {
                <div
                  className={`relative flex ${
                    isFirstQuestionAnswered ? "h-[100%]" : "h-[200%]"
                  } w-0.5 items-center justify-center`}
                  style={{
                    background:
                      "repeating-linear-gradient(rgb(148, 163, 184), rgb(148, 163, 184) 5px, transparent 5px, transparent 8px)", // adjust the values to fit your design
                  }}>
                  <CheckCircle2Icon className="absolute top-0 w-[1.5rem] min-w-[1.5rem] rounded-full bg-white p-0.25 text-slate-400" />
                </div>
              }
              <div className="ml-6 flex flex-col text-slate-700">{t("common.welcome_card")}</div>
            </div>
          )}
          {status === "skipped" && (
            <div className="flex">
              <div
                className="flex w-0.5 items-center justify-center"
                style={{
                  background:
                    "repeating-linear-gradient(to bottom,   rgb(148 163 184),  rgb(148 163 184) 8px, transparent 5px, transparent 15px)", // adjust the values to fit your design
                }}>
                {skippedQuestions.length > 1 && (
                  <TooltipProvider delayDuration={50}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ChevronsDownIcon className="w-[1.25rem] min-w-[1.25rem] rounded-full bg-slate-400 p-0.5 text-white" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p data-testid="tooltip-respondent_skipped_questions">
                          {t("environments.surveys.responses.respondent_skipped_questions")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="ml-6 flex flex-col">
                {skippedQuestions &&
                  skippedQuestions.map((questionId) => {
                    return (
                      <p className="my-2" key={questionId}>
                        {parseRecallInfo(
                          getLocalizedValue(
                            questions.find((question) => question.id === questionId)!.headline,
                            "default"
                          ),
                          responseData
                        )}
                      </p>
                    );
                  })}
              </div>
            </div>
          )}
          {status === "aborted" && (
            <div className="flex">
              <div
                className="flex w-0.5 flex-grow items-start justify-center"
                style={{
                  background:
                    "repeating-linear-gradient(to bottom,  rgb(148 163 184),  rgb(148 163 184) 2px, transparent 2px, transparent 10px)", // adjust the 2px to change dot size and 10px to change space between dots
                }}>
                <div className="flex">
                  <XCircleIcon className="min-h-[1.5rem] min-w-[1.5rem] rounded-full bg-white text-slate-400" />
                </div>
              </div>
              <div className="mb-2 ml-4 flex flex-col">
                <p
                  data-testid="tooltip-survey_closed"
                  className="mb-2 w-fit rounded-lg bg-slate-100 px-2 font-medium text-slate-700">
                  {t("environments.surveys.responses.survey_closed")}
                </p>
                {skippedQuestions &&
                  skippedQuestions.map((questionId) => {
                    return (
                      <p className="my-2" key={questionId}>
                        {parseRecallInfo(
                          getLocalizedValue(
                            questions.find((question) => question.id === questionId)!.headline,
                            "default"
                          ),
                          responseData
                        )}
                      </p>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
