"use client";

import { CheckCircle2Icon, ChevronsDownIcon, EyeOffIcon, XCircleIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { TUserLocale } from "@formbricks/types/user";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getSurveyDateFormatMap } from "@/lib/utils/date-display";
import { parseRecallInfo } from "@/lib/utils/recall";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface ElementSkipProps {
  skippedElements: string[] | undefined;
  /** `notShown`: the response's not-shown record lists these questions (ENG-6936). */
  status: "welcomeCard" | "skipped" | "aborted" | "notShown";
  elements: TSurveyElement[];
  isFirstElementAnswered?: boolean;
  /**
   * Recall's lookup map, not the raw `response.data` this used to take (ENG-2538). Named for what it
   * is because it is more than the response: the parent merges the survey's readable reserved-field
   * values under the answers, so a headline recalling `country` or `url` resolves here instead of
   * falling back. Used for nothing else in this component.
   */
  recallValues: TResponseData;
  /** Recall resolves variables ahead of `recallValues`, and they are not in it — see `parseRecallInfo`. */
  variables: TResponseVariables;
  locale: TUserLocale;
}

export const ElementSkip = ({
  skippedElements,
  status,
  elements,
  isFirstElementAnswered,
  recallValues,
  variables,
  locale,
}: Readonly<ElementSkipProps>) => {
  const { t } = useTranslation();
  const dateFormats = getSurveyDateFormatMap(elements);
  return (
    <div>
      {skippedElements && (
        <div className="my-2 flex w-full px-2 text-sm text-slate-400">
          {status === "welcomeCard" && (
            <div className="mb-2 flex">
              {
                <div
                  className={`relative flex ${
                    isFirstElementAnswered ? "h-full" : "h-[200%]"
                  } w-0.5 items-center justify-center`}
                  style={{
                    background:
                      "repeating-linear-gradient(rgb(148, 163, 184), rgb(148, 163, 184) 5px, transparent 5px, transparent 8px)",
                  }}>
                  <CheckCircle2Icon className="absolute top-0 w-6 min-w-6 rounded-full bg-white p-0.25 text-slate-400" />
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
                    "repeating-linear-gradient(to bottom,   rgb(148 163 184),  rgb(148 163 184) 8px, transparent 5px, transparent 15px)",
                }}>
                {skippedElements.length > 1 && (
                  <TooltipProvider delayDuration={50}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ChevronsDownIcon className="w-5 min-w-5 rounded-full bg-slate-400 p-0.5 text-white" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p data-testid="tooltip-respondent_skipped_questions">
                          {t("workspace.surveys.responses.respondent_skipped_questions")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="ml-6 flex flex-col">
                {skippedElements?.map((questionId) => {
                  return (
                    <p className="my-2" key={questionId}>
                      {getTextContent(
                        parseRecallInfo(
                          getLocalizedValue(
                            elements.find((question) => question.id === questionId)?.headline ?? {
                              default: "",
                            },
                            "default"
                          ),
                          recallValues,
                          variables,
                          false,
                          locale,
                          dateFormats
                        )
                      )}
                    </p>
                  );
                })}
              </div>
            </div>
          )}
          {status === "notShown" && (
            <div className="flex">
              <div
                className="flex w-0.5 items-start justify-center"
                style={{
                  background:
                    "repeating-linear-gradient(to bottom,   rgb(203 213 225),  rgb(203 213 225) 8px, transparent 5px, transparent 15px)",
                }}>
                <EyeOffIcon className="min-h-6 min-w-6 rounded-full bg-white p-0.5 text-slate-400" />
              </div>
              <div className="mb-2 ml-4 flex flex-col">
                <TooltipProvider delayDuration={50}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p
                        data-testid="response-card-not-shown"
                        className="mb-2 w-fit rounded-lg bg-slate-100 px-2 font-medium text-slate-700">
                        {t("workspace.surveys.responses.not_shown")}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("workspace.surveys.responses.respondent_not_shown_questions")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {skippedElements.map((questionId) => (
                  <p className="my-2" key={questionId}>
                    {getTextContent(
                      parseRecallInfo(
                        getLocalizedValue(
                          elements.find((question) => question.id === questionId)?.headline ?? {
                            default: "",
                          },
                          "default"
                        ),
                        recallValues,
                        variables,
                        false,
                        locale,
                        dateFormats
                      )
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}
          {status === "aborted" && (
            <div className="flex">
              <div
                className="flex w-0.5 grow items-start justify-center"
                style={{
                  background:
                    "repeating-linear-gradient(to bottom,  rgb(148 163 184),  rgb(148 163 184) 2px, transparent 2px, transparent 10px)",
                }}>
                <div className="flex">
                  <XCircleIcon className="min-h-6 min-w-6 rounded-full bg-white text-slate-400" />
                </div>
              </div>
              <div className="mb-2 ml-4 flex flex-col">
                <p
                  data-testid="tooltip-survey_closed"
                  className="mb-2 w-fit rounded-lg bg-slate-100 px-2 font-medium text-slate-700">
                  {t("workspace.surveys.responses.survey_closed")}
                </p>
                {skippedElements &&
                  skippedElements.map((questionId) => {
                    return (
                      <p className="my-2" key={questionId}>
                        {getTextContent(
                          parseRecallInfo(
                            getLocalizedValue(
                              elements.find((question) => question.id === questionId)?.headline ?? {
                                default: "",
                              },
                              "default"
                            ),
                            recallValues,
                            variables,
                            false,
                            locale,
                            dateFormats
                          )
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
