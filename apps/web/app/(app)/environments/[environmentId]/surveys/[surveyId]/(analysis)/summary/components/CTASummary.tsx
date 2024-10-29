import { InboxIcon } from "lucide-react";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyQuestionSummaryCta } from "@formbricks/types/surveys/types";
import { ProgressBar } from "@formbricks/ui/components/ProgressBar";
import { convertFloatToNDecimal } from "../lib/utils";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface CTASummaryProps {
  questionSummary: TSurveyQuestionSummaryCta;
  survey: TSurvey;
  attributeClasses: TAttributeClass[];
}

export const CTASummary = ({ questionSummary, survey, attributeClasses }: CTASummaryProps) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader
        survey={survey}
        questionSummary={questionSummary}
        showResponses={false}
        attributeClasses={attributeClasses}
        additionalInfo={
          <>
            <div className="flex items-center rounded-lg bg-slate-100 p-2">
              <InboxIcon className="mr-2 h-4 w-4" />
              {`${questionSummary.impressionCount} Impressions`}
            </div>
            <div className="flex items-center rounded-lg bg-slate-100 p-2">
              <InboxIcon className="mr-2 h-4 w-4" />
              {`${questionSummary.clickCount} Clicks`}
            </div>
            {!questionSummary.question.required && (
              <div className="flex items-center rounded-lg bg-slate-100 p-2">
                <InboxIcon className="mr-2 h-4 w-4" />
                {`${questionSummary.skipCount} Skips`}
              </div>
            )}
          </>
        }
      />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        <div className="text flex justify-between px-2 pb-2">
          <div className="mr-8 flex space-x-1">
            <p className="font-semibold text-slate-700">CTR</p>
            <div>
              <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                {convertFloatToNDecimal(questionSummary.ctr.percentage, 2)}%
              </p>
            </div>
          </div>
          <p className="flex w-32 items-end justify-end text-slate-600">
            {questionSummary.ctr.count} {questionSummary.ctr.count === 1 ? "Click" : "Clicks"}
          </p>
        </div>
        <ProgressBar barColor="bg-brand-dark" progress={questionSummary.ctr.percentage / 100} />
      </div>
    </div>
  );
};
