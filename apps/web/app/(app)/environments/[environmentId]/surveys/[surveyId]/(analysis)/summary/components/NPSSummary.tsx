import { TSurveyQuestionSummaryNps } from "@formbricks/types/surveys";
import { HalfCircle, ProgressBar } from "@formbricks/ui/ProgressBar";

import { convertFloatToNDecimal } from "../lib/utils";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface NPSSummaryProps {
  questionSummary: TSurveyQuestionSummaryNps;
}

export const NPSSummary = ({ questionSummary }: NPSSummaryProps) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader questionSummary={questionSummary} />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        {["promoters", "passives", "detractors"].map((group) => (
          <div key={group}>
            <div className="mb-2 flex justify-between">
              <div className="mr-8 flex space-x-1">
                <p className="font-semibold capitalize text-slate-700">{group}</p>
                <div>
                  <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                    {convertFloatToNDecimal(questionSummary[group].percentage, 1)}%
                  </p>
                </div>
              </div>
              <p className="flex w-32 items-end justify-end text-slate-600">
                {questionSummary[group].count} {questionSummary[group].count === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar barColor="bg-brand-dark" progress={questionSummary[group].percentage / 100} />
          </div>
        ))}
      </div>
      {questionSummary.dismissed?.count > 0 && (
        <div className="border-t bg-white px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
          <div key={"dismissed"}>
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
      <div className="flex justify-center pb-4 pt-4">
        <HalfCircle value={questionSummary.score} />
      </div>
    </div>
  );
};
