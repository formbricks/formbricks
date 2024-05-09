import { TSurveyQuestionSummaryConsent } from "@formbricks/types/surveys";
import { ProgressBar } from "@formbricks/ui/ProgressBar";

import { convertFloatToNDecimal } from "../lib/utils";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface ConsentSummaryProps {
  questionSummary: TSurveyQuestionSummaryConsent;
}

export const ConsentSummary = ({ questionSummary }: ConsentSummaryProps) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader questionSummary={questionSummary} />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        <div>
          <div className="text flex justify-between px-2 pb-2">
            <div className="mr-8 flex space-x-1">
              <p className="font-semibold text-slate-700">Accepted</p>
              <div>
                <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                  {convertFloatToNDecimal(questionSummary.accepted.percentage, 1)}%
                </p>
              </div>
            </div>
            <p className="flex w-32 items-end justify-end text-slate-600">
              {questionSummary.accepted.count}{" "}
              {questionSummary.accepted.count === 1 ? "response" : "responses"}
            </p>
          </div>
          <ProgressBar barColor="bg-brand-dark" progress={questionSummary.accepted.percentage / 100} />
        </div>
        <div>
          <div className="text flex justify-between px-2 pb-2">
            <div className="mr-8 flex space-x-1">
              <p className="font-semibold text-slate-700">Dismissed</p>
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
          <ProgressBar barColor="bg-brand-dark" progress={questionSummary.dismissed.percentage / 100} />
        </div>
      </div>
    </div>
  );
};
