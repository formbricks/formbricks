"use client";

import { CircleSlash2, SmileIcon, StarIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { type TI18nString } from "@formbricks/types/i18n";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyElementSummaryCes } from "@formbricks/types/surveys/types";
import { RatingLikeSummary } from "./RatingLikeSummary";

interface CESSummaryProps {
  elementSummary: TSurveyElementSummaryCes;
  survey: TSurvey;
  setFilter: (
    elementId: string,
    label: TI18nString,
    elementType: TSurveyElementTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const CESSummary = ({ elementSummary, survey, setFilter }: CESSummaryProps) => {
  const { t } = useTranslation();

  const getIconBasedOnScale = useMemo(() => {
    const scale = elementSummary.element.scale;
    if (scale === "number") return <CircleSlash2 className="h-4 w-4" />;
    else if (scale === "star") return <StarIcon fill="rgb(250 204 21)" className="h-4 w-4 text-yellow-400" />;
    else if (scale === "smiley") return <SmileIcon className="h-4 w-4" />;
  }, [elementSummary.element.scale]);

  return (
    <RatingLikeSummary
      elementSummary={elementSummary}
      survey={survey}
      setFilter={setFilter}
      additionalInfo={
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 rounded-lg bg-slate-100 p-2">
            {getIconBasedOnScale}
            <div>
              {t("workspace.surveys.summary.effort_score")}: {elementSummary.average.toFixed(2)} /{" "}
              {elementSummary.element.range}
            </div>
          </div>
        </div>
      }
    />
  );
};
