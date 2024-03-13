import Headline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/Headline";
import { questionTypes } from "@/app/lib/questions";
import { InboxIcon } from "lucide-react";

import { TSurveySummaryConsent } from "@formbricks/types/responses";
import { ProgressBar } from "@formbricks/ui/ProgressBar";

interface ConsentSummaryProps {
  questionSummary: TSurveySummaryConsent;
}

export default function ConsentSummary({ questionSummary }: ConsentSummaryProps) {
  const questionTypeInfo = questionTypes.find((type) => type.id === questionSummary.question.type);

  return (
    <div className=" rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
        <Headline headline={questionSummary.question.headline} />

        <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
          <div className=" flex items-center rounded-lg bg-slate-100 p-2">
            {questionTypeInfo && <questionTypeInfo.icon className="mr-2 h-4 w-4 " />}
            {questionTypeInfo ? questionTypeInfo.label : "Unknown Question Type"}
          </div>
          <div className=" flex items-center rounded-lg bg-slate-100 p-2">
            <InboxIcon className="mr-2 h-4 w-4 " />
            {questionSummary.responseCount} responses
          </div>
          {!questionSummary.question.required && (
            <div className="flex items-center  rounded-lg bg-slate-100 p-2">Optional</div>
          )}
        </div>
      </div>
      <div className="space-y-5 rounded-b-lg bg-white px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        <div>
          <div className="text flex justify-between px-2 pb-2">
            <div className="mr-8 flex space-x-1">
              <p className="font-semibold text-slate-700">Accepted</p>
              <div>
                <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                  {Math.round(questionSummary.accepted.percentage)}%
                </p>
              </div>
            </div>
            <p className="flex w-32 items-end justify-end text-slate-600">
              {questionSummary.accepted.count}{" "}
              {questionSummary.accepted.count === 1 ? "response" : "responses"}
            </p>
          </div>
          <ProgressBar barColor="bg-brand" progress={questionSummary.accepted.percentage / 100} />
        </div>
        <div>
          <div className="text flex justify-between px-2 pb-2">
            <div className="mr-8 flex space-x-1">
              <p className="font-semibold text-slate-700">Dismissed</p>
              <div>
                <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                  {Math.round(questionSummary.dismissed.percentage)}%
                </p>
              </div>
            </div>
            <p className="flex w-32 items-end justify-end text-slate-600">
              {questionSummary.dismissed.count}{" "}
              {questionSummary.dismissed.count === 1 ? "response" : "responses"}
            </p>
          </div>
          <ProgressBar barColor="bg-brand" progress={questionSummary.dismissed.percentage / 100} />
        </div>
      </div>
    </div>
  );
}
