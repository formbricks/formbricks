import { convertFloatToNDecimal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { CircleSlash2, SmileIcon, StarIcon } from "lucide-react";
import { useMemo } from "react";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import {
  TI18nString,
  TSurvey,
  TSurveyQuestionSummaryRating,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { ProgressBar } from "@formbricks/ui/ProgressBar";
import { RatingResponse } from "@formbricks/ui/RatingResponse";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface RatingSummaryProps {
  questionSummary: TSurveyQuestionSummaryRating;
  survey: TSurvey;
  attributeClasses: TAttributeClass[];
  setFilter: (
    questionId: string,
    label: TI18nString,
    questionType: TSurveyQuestionTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const RatingSummary = ({
  questionSummary,
  survey,
  attributeClasses,
  setFilter,
}: RatingSummaryProps) => {
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
        attributeClasses={attributeClasses}
        insights={
          <div className="flex items-center space-x-2 rounded-lg bg-slate-100 p-2">
            {getIconBasedOnScale}
            <div>Overall: {questionSummary.average.toFixed(2)}</div>
          </div>
        }
      />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        {questionSummary.choices.map((result) => (
          <div
            className="cursor-pointer hover:opacity-80"
            key={result.rating}
            onClick={() =>
              setFilter(
                questionSummary.question.id,
                questionSummary.question.headline,
                questionSummary.question.type,
                "Is equal to",
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
                    {convertFloatToNDecimal(result.percentage, 1)}%
                  </p>
                </div>
              </div>
              <p className="flex w-32 items-end justify-end text-slate-600">
                {result.count} {result.count === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar barColor="bg-brand-dark" progress={result.percentage / 100} />
          </div>
        ))}
      </div>
      {questionSummary.dismissed && questionSummary.dismissed.count > 0 && (
        <div className="rounded-b-lg border-t bg-white px-6 py-4">
          <div key="dismissed">
            <div className="text flex justify-between px-2">
              <p className="font-semibold text-slate-700">dismissed</p>
              <p className="flex w-32 items-end justify-end text-slate-600">
                {questionSummary.dismissed.count}{" "}
                {questionSummary.dismissed.count === 1 ? "response" : "responses"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
