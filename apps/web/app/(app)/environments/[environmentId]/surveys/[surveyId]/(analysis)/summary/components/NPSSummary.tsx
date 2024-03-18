import Headline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/Headline";
import { questionTypes } from "@/app/lib/questions";
import { InboxIcon } from "lucide-react";

import { TSurveySummaryNps } from "@formbricks/types/responses";
import { HalfCircle, ProgressBar } from "@formbricks/ui/ProgressBar";

interface NPSSummaryProps {
  questionSummary: TSurveySummaryNps;
}

export default function NPSSummary({ questionSummary }: NPSSummaryProps) {
  const questionTypeInfo = questionTypes.find((type) => type.id === questionSummary.question.type);

  return (
    <div className=" rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
        <Headline headline={questionSummary.question.headline} />

        <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
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
        {["promoters", "passives", "detractors"].map((group) => (
          <div key={group}>
            <div className="mb-2 flex justify-between">
              <div className="mr-8 flex space-x-1">
                <p className="font-semibold capitalize text-slate-700">{group}</p>
                <div>
                  <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                    {Math.round(questionSummary[group].percentage)}%
                  </p>
                </div>
              </div>
              <p className="flex w-32 items-end justify-end text-slate-600">
                {questionSummary[group].count} {questionSummary[group].count === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar barColor="bg-brand" progress={questionSummary[group].percentage / 100} />
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
                    {Math.round(questionSummary.dismissed.percentage)}%
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
      <div className="flex justify-center rounded-b-lg bg-white pb-4 pt-4">
        <HalfCircle value={questionSummary.score} />
      </div>
    </div>
  );
}
