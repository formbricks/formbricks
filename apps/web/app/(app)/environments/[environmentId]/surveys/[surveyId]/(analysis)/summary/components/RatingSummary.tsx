"use client";

import { BarChart, BarChartHorizontal, CircleSlash2, SmileIcon, StarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TI18nString,
  TSurvey,
  TSurveyQuestionId,
  TSurveyQuestionSummaryRating,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { convertFloatToNDecimal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import { RatingResponse } from "@/modules/ui/components/rating-response";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";
import { SatisfactionSmiley } from "./SatisfactionSmiley";

interface RatingSummaryProps {
  questionSummary: TSurveyQuestionSummaryRating;
  survey: TSurvey;
  setFilter: (
    questionId: TSurveyQuestionId,
    label: TI18nString,
    questionType: TSurveyQuestionTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const RatingSummary = ({ questionSummary, survey, setFilter }: RatingSummaryProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"grouped" | "individual">("grouped");

  const getIconBasedOnScale = useMemo(() => {
    const scale = questionSummary.question.scale;
    if (scale === "number") return <CircleSlash2 className="h-4 w-4" />;
    else if (scale === "star") return <StarIcon fill="rgb(250 204 21)" className="h-4 w-4 text-yellow-400" />;
    else if (scale === "smiley") return <SmileIcon className="h-4 w-4" />;
  }, [questionSummary]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader
        questionSummary={questionSummary}
        survey={survey}
        additionalInfo={
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 rounded-lg bg-slate-100 p-2">
              {getIconBasedOnScale}
              <div>
                {t("environments.surveys.summary.overall")}: {questionSummary.average.toFixed(2)}
              </div>
            </div>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2 rounded-lg bg-slate-100 p-2">
                    <SatisfactionSmiley percentage={questionSummary.csat.satisfiedPercentage} />
                    <div>
                      CSAT: {questionSummary.csat.satisfiedPercentage}%{" "}
                      {t("environments.surveys.summary.satisfied")}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>{t("environments.surveys.summary.csatTooltip")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "grouped" | "individual")}>
        <div className="flex justify-end px-4 md:px-6">
          <TabsList>
            <TabsTrigger value="grouped" icon={<BarChartHorizontal className="h-4 w-4" />}>
              {t("environments.surveys.summary.grouped")}
            </TabsTrigger>
            <TabsTrigger value="individual" icon={<BarChart className="h-4 w-4" />}>
              {t("environments.surveys.summary.individual")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="grouped" className="mt-4">
          <div className="px-4 pb-6 pt-4 md:px-6">
            {questionSummary.responseCount === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
                <p className="text-sm text-slate-500">
                  {t("environments.surveys.summary.no_responses_found")}
                </p>
              </div>
            ) : (
              <>
                <div className="flex h-12 w-full overflow-hidden rounded-t-lg border border-slate-200">
                  {questionSummary.choices.map((result, index) => {
                    if (result.percentage === 0) return null;
                    // Calculate opacity based on rating position (higher rating = higher opacity)
                    const range = questionSummary.question.range;
                    const opacity = 0.3 + (result.rating / range) * 0.7; // Range from 30% to 100%

                    return (
                      <button
                        key={result.rating}
                        className="relative h-full cursor-pointer transition-opacity hover:brightness-110"
                        style={{
                          width: `${result.percentage}%`,
                          borderRight:
                            index < questionSummary.choices.length - 1
                              ? "1px solid rgb(226, 232, 240)"
                              : "none",
                        }}
                        onClick={() =>
                          setFilter(
                            questionSummary.question.id,
                            questionSummary.question.headline,
                            questionSummary.question.type,
                            t("environments.surveys.summary.is_equal_to"),
                            result.rating.toString()
                          )
                        }>
                        <div
                          className={`h-full ${index === 0 ? "rounded-tl-lg" : ""} ${
                            index === questionSummary.choices.length - 1 ? "rounded-tr-lg" : ""
                          } bg-brand-dark`}
                          style={{ opacity }}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="flex w-full overflow-hidden rounded-b-lg border border-t-0 border-slate-200 bg-slate-50">
                  {questionSummary.choices.map((result, index) => {
                    if (result.percentage === 0) return null;

                    return (
                      <div
                        key={result.rating}
                        className="flex flex-col items-center justify-center py-2"
                        style={{
                          width: `${result.percentage}%`,
                          borderRight:
                            index < questionSummary.choices.length - 1
                              ? "1px solid rgb(226, 232, 240)"
                              : "none",
                        }}>
                        <div className="mb-1 flex items-center justify-center">
                          <RatingResponse
                            scale={questionSummary.question.scale}
                            answer={result.rating}
                            range={questionSummary.question.range}
                            addColors={false}
                          />
                        </div>
                        <div className="text-xs font-medium text-slate-600">
                          {convertFloatToNDecimal(result.percentage, 1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
                {questionSummary.question.scale === "star" && (
                  <div className="mt-3 flex w-full items-center justify-center space-x-3 px-1">
                    <StarIcon className="h-6 w-6 text-slate-300" />
                    <span className="text-xs text-slate-500">1 - {questionSummary.question.range}</span>
                    <StarIcon fill="rgb(250 204 21)" className="h-6 w-6 text-yellow-400" />
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="individual" className="mt-4">
          <div className="px-4 pb-6 pt-4 md:px-6">
            <div className="space-y-5 text-sm md:text-base">
              {questionSummary.choices.map((result) => (
                <button
                  className="w-full cursor-pointer hover:opacity-80"
                  key={result.rating}
                  onClick={() =>
                    setFilter(
                      questionSummary.question.id,
                      questionSummary.question.headline,
                      questionSummary.question.type,
                      t("environments.surveys.summary.is_equal_to"),
                      result.rating.toString()
                    )
                  }>
                  <div className="text flex justify-between px-2 pb-2">
                    <div className="mr-8 flex items-center space-x-1">
                      <div className="font-semibold text-slate-700">
                        <RatingResponse
                          scale={questionSummary.question.scale}
                          answer={result.rating}
                          range={questionSummary.question.range}
                          addColors={questionSummary.question.isColorCodingEnabled}
                        />
                      </div>
                      <div>
                        <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                          {convertFloatToNDecimal(result.percentage, 2)}%
                        </p>
                      </div>
                    </div>
                    <p className="flex w-32 items-end justify-end text-slate-600">
                      {result.count} {result.count === 1 ? t("common.response") : t("common.responses")}
                    </p>
                  </div>
                  <ProgressBar barColor="bg-brand-dark" progress={result.percentage / 100} />
                </button>
              ))}
            </div>
            {questionSummary.question.scale === "star" && (
              <div className="mt-5 flex w-full items-center justify-center space-x-3 px-1">
                <StarIcon className="h-6 w-6 text-slate-300" />
                <span className="text-xs text-slate-500">1 - {questionSummary.question.range}</span>
                <StarIcon fill="rgb(250 204 21)" className="h-6 w-6 text-yellow-400" />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      {questionSummary.dismissed && questionSummary.dismissed.count > 0 && (
        <div className="rounded-b-lg border-t bg-white px-6 py-4">
          <div key="dismissed">
            <div className="text flex justify-between px-2">
              <p className="font-semibold text-slate-700">{t("common.dismissed")}</p>
              <p className="flex w-32 items-end justify-end text-slate-600">
                {questionSummary.dismissed.count}{" "}
                {questionSummary.dismissed.count === 1 ? t("common.response") : t("common.responses")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
