import { useTranslation } from "react-i18next";
import { TSurvey, TSurveyElementSummaryRanking, TSurveyType } from "@formbricks/types/surveys/types";
import { getChoiceIdByValue } from "@/lib/response/utils";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { convertFloatToNDecimal } from "../lib/utils";
import { ElementSummaryHeader } from "./ElementSummaryHeader";
import { OtherValuesList } from "./OtherValuesList";

interface RankingSummaryProps {
  elementSummary: TSurveyElementSummaryRanking;
  surveyType: TSurveyType;
  survey: TSurvey;
}

export const RankingSummary = ({ elementSummary, surveyType, survey }: RankingSummaryProps) => {
  // sort by count and transform to array
  const { t } = useTranslation();
  // Best average rank first; a choice nobody ranked has no average, so it goes last.
  const results = Object.values(elementSummary.choices).sort((a, b) => {
    if (a.count === 0 || b.count === 0) return b.count - a.count;
    return a.avgRanking - b.avgRanking;
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <ElementSummaryHeader elementSummary={elementSummary} survey={survey} />
      <div className="space-y-5 px-4 pt-4 pb-6 text-sm md:px-6 md:text-base">
        {results.map((result, resultsIdx) => {
          const choiceId = getChoiceIdByValue(result.value, elementSummary.element);
          return (
            <div key={result.value} className="group cursor-pointer">
              <div className="text flex flex-col justify-between px-2 pb-2 sm:flex-row">
                <div className="mr-8 flex w-full justify-between gap-x-2 sm:justify-normal">
                  <div className="flex w-full items-center">
                    <div className="flex items-center gap-x-2">
                      <span className="mr-2 text-slate-400">#{resultsIdx + 1}</span>
                      <div className="rounded-sm bg-slate-100 px-2 py-1">{result.value}</div>
                      {choiceId && <IdBadge id={choiceId} />}
                    </div>
                    <span className="ml-auto flex items-center gap-x-1">
                      <span className="font-bold text-slate-600">
                        #{convertFloatToNDecimal(result.avgRanking, 2)}
                      </span>
                      <span>{t("workspace.surveys.summary.average")}</span>
                    </span>
                  </div>
                </div>
              </div>
              {result.others && result.others.length > 0 && (
                <OtherValuesList others={result.others} surveyType={surveyType} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
