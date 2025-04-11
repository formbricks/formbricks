import { useTranslate } from "@tolgee/react";
import { TSurvey, TSurveyQuestionSummaryRanking, TSurveyType } from "@formbricks/types/surveys/types";
import { convertFloatToNDecimal } from "../lib/utils";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface RankingSummaryProps {
  questionSummary: TSurveyQuestionSummaryRanking;
  surveyType: TSurveyType;
  survey: TSurvey;
}

export const RankingSummary = ({ questionSummary, surveyType, survey }: RankingSummaryProps) => {
  // sort by count and transform to array
  const { t } = useTranslate();
  const results = Object.values(questionSummary.choices).sort((a, b) => {
    return a.avgRanking - b.avgRanking; // Sort by count
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <QuestionSummaryHeader questionSummary={questionSummary} survey={survey} />
      <div className="space-y-5 px-4 pt-4 pb-6 text-sm md:px-6 md:text-base">
        {results.map((result, resultsIdx) => (
          <div key={result.value} className="group cursor-pointer">
            <div className="text flex flex-col justify-between px-2 pb-2 sm:flex-row">
              <div className="mr-8 flex w-full justify-between space-x-1 sm:justify-normal">
                <div className="flex w-full items-center">
                  <span className="mr-2 text-slate-400">#{resultsIdx + 1}</span>
                  <div className="rounded-sm bg-slate-100 px-2 py-1">{result.value}</div>
                  <span className="ml-auto flex items-center space-x-1">
                    <span className="font-bold text-slate-600">
                      #{convertFloatToNDecimal(result.avgRanking, 2)}
                    </span>
                    <span>{t("environments.surveys.summary.average")}</span>
                  </span>
                </div>
              </div>
            </div>

            {result.others && result.others.length > 0 && (
              <div className="mt-4 rounded-lg border border-slate-200">
                <div className="grid h-12 grid-cols-2 content-center rounded-t-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
                  <div className="col-span-1 pl-6">
                    {t("environments.surveys.summary.other_values_found")}
                  </div>
                  <div className="col-span-1 pl-6">{surveyType === "app" && t("common.user")}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
