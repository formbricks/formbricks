import { convertFloatToNDecimal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/utils";

import { TSurveyQuestionSummaryRating } from "@formbricks/types/surveys";
import { ProgressBar } from "@formbricks/ui/ProgressBar";
import { RatingResponse } from "@formbricks/ui/RatingResponse";

import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface RatingSummaryProps {
  questionSummary: TSurveyQuestionSummaryRating;
}

export const RatingSummary = ({ questionSummary }: RatingSummaryProps) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader questionSummary={questionSummary} />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        {questionSummary.choices.map((result) => (
          <div key={result.rating}>
            <div className="text flex justify-between px-2 pb-2">
              <div className="mr-8 flex items-center space-x-1">
                <div className="font-semibold text-slate-700">
                  <RatingResponse
                    scale={questionSummary.question.scale}
                    answer={result.rating}
                    range={questionSummary.question.range}
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
        <div className="rounded-b-lg border-t bg-white px-6 pb-6 pt-4">
          <div key="dismissed">
            <div className="text flex justify-between px-2 pb-2">
              <div className="mr-8 flex space-x-1">
                <p className="font-semibold text-slate-700">dismissed</p>
                <div>
                  <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                    {convertFloatToNDecimal(questionSummary.dismissed.percentage, 1)}%
                  </p>
                </div>
              </div>
              <p className="flex w-32 items-end justify-end text-slate-600">
                {questionSummary.dismissed.count}{" "}
                {questionSummary.dismissed.count === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar barColor="bg-slate-600" progress={questionSummary.dismissed.percentage / 100} />
          </div>
        </div>
      )}
    </div>
  );
};
