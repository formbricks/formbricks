"use client";

import { CircleSlash2, SmileIcon, StarIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { type TI18nString } from "@formbricks/types/i18n";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyElementSummaryCsat } from "@formbricks/types/surveys/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { RatingLikeSummary } from "./RatingLikeSummary";
import { SatisfactionIndicator } from "./SatisfactionIndicator";

interface CSATSummaryProps {
  elementSummary: TSurveyElementSummaryCsat;
  survey: TSurvey;
  setFilter: (
    elementId: string,
    label: TI18nString,
    elementType: TSurveyElementTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const CSATSummary = ({ elementSummary, survey, setFilter }: CSATSummaryProps) => {
  const { t } = useTranslation();

  const getIconBasedOnScale = useMemo(() => {
    const scale = elementSummary.element.scale;
    if (scale === "number") return <CircleSlash2 className="size-4" />;
    else if (scale === "star") return <StarIcon fill="rgb(250 204 21)" className="size-4 text-yellow-400" />;
    else if (scale === "smiley") return <SmileIcon className="size-4" />;
  }, [elementSummary.element.scale]);

  return (
    <RatingLikeSummary
      elementSummary={elementSummary}
      survey={survey}
      setFilter={setFilter}
      additionalInfo={
        <div className="flex items-center gap-x-2">
          <div className="flex items-center gap-x-2 rounded-lg bg-slate-100 p-2">
            {getIconBasedOnScale}
            <div>
              {t("workspace.surveys.summary.overall")}: {elementSummary.average.toFixed(2)}
            </div>
          </div>

          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-x-2 rounded-lg bg-slate-100 p-2">
                  <SatisfactionIndicator percentage={elementSummary.csat.satisfiedPercentage} />
                  <div>
                    {t("workspace.surveys.summary.csat_satisfied", {
                      percentage: elementSummary.csat.satisfiedPercentage,
                    })}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("workspace.surveys.summary.csat_satisfied_tooltip", {
                  percentage: elementSummary.csat.satisfiedPercentage,
                })}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      }
    />
  );
};
