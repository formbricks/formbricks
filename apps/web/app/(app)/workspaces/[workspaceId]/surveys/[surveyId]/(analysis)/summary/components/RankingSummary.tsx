import { useTranslation } from "react-i18next";
import { TSurvey, TSurveyElementSummaryRanking } from "@formbricks/types/surveys/types";
import { getChoiceIdByValue } from "@/lib/response/utils";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { convertFloatToNDecimal } from "../lib/utils";
import { ElementSummaryHeader } from "./ElementSummaryHeader";

interface RankingSummaryProps {
  elementSummary: TSurveyElementSummaryRanking;
  survey: TSurvey;
}

export const RankingSummary = ({ elementSummary, survey }: RankingSummaryProps) => {
  // sort by count and transform to array
  const { t } = useTranslation();
  const results = Object.values(elementSummary.choices).sort((a, b) => {
    return a.avgRanking - b.avgRanking; // Sort by count
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <ElementSummaryHeader elementSummary={elementSummary} survey={survey} />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        {results.map((result, resultsIdx) => {
          const choiceId = getChoiceIdByValue(result.value, elementSummary.element);
          return (
            <div key={result.value} className="group cursor-pointer">
              <div className="text flex flex-col justify-between px-2 pb-2 sm:flex-row">
                <div className="mr-8 flex w-full justify-between space-x-2 sm:justify-normal">
                  <div className="flex w-full items-center">
                    <div className="flex items-center space-x-2">
                      <span className="mr-2 text-slate-400">#{resultsIdx + 1}</span>
                      <div className="rounded bg-slate-100 px-2 py-1">{result.value}</div>
                      {choiceId && <IdBadge id={choiceId} />}
                    </div>
                    <span className="ml-auto flex items-center space-x-1">
                      <span className="font-bold text-slate-600">
                        #{convertFloatToNDecimal(result.avgRanking, 2)}
                      </span>
                      <span>{t("environments.surveys.summary.average")}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
