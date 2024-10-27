import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyQuestionSummaryRanking, TSurveyType } from "@formbricks/types/surveys/types";
import { convertFloatToNDecimal } from "../lib/utils";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface RankingSummaryProps {
  questionSummary: TSurveyQuestionSummaryRanking;
  surveyType: TSurveyType;
  survey: TSurvey;
  attributeClasses: TAttributeClass[];
}

export const RankingSummary = ({
  questionSummary,
  surveyType,
  survey,
  attributeClasses,
}: RankingSummaryProps) => {
  // sort by count and transform to array
  const results = Object.values(questionSummary.choices).sort((a, b) => {
    return a.avgRanking - b.avgRanking; // Sort by count
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader
        questionSummary={questionSummary}
        survey={survey}
        attributeClasses={attributeClasses}
      />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        {results.map((result, resultsIdx) => (
          <div key={result.value} className="group cursor-pointer">
            <div className="text flex flex-col justify-between px-2 pb-2 sm:flex-row">
              <div className="mr-8 flex w-full justify-between space-x-1 sm:justify-normal">
                <div className="flex w-full items-center">
                  <span className="mr-2 text-gray-400">#{resultsIdx + 1}</span>
                  <div className="rounded bg-gray-100 px-2 py-1">{result.value}</div>
                  <span className="ml-auto flex items-center space-x-1">
                    <span className="font-bold text-slate-600">
                      #{convertFloatToNDecimal(result.avgRanking, 2)}
                    </span>
                    <span>average</span>
                  </span>
                </div>
              </div>
            </div>

            {result.others && result.others.length > 0 && (
              <div className="mt-4 rounded-lg border border-slate-200">
                <div className="grid h-12 grid-cols-2 content-center rounded-t-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
                  <div className="col-span-1 pl-6">Other values found</div>
                  <div className="col-span-1 pl-6">{surveyType === "app" && "User"}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
