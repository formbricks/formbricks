import type { QuestionSummary } from "@formbricks/types/responses";
import { ProgressBar } from "@formbricks/ui";
import { InboxStackIcon } from "@heroicons/react/24/solid";
import { useMemo } from "react";
import { TSurveyConsentQuestion } from "@formbricks/types/v1/surveys";
import { questionTypes } from "@/lib/questions";
import Headline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/Headline";

interface ConsentSummaryProps {
  questionSummary: QuestionSummary<TSurveyConsentQuestion>;
}

interface ChoiceResult {
  count: number;
  acceptedCount: number;
  acceptedPercentage: number;
  dismissedCount: number;
  dismissedPercentage: number;
}

export default function ConsentSummary({ questionSummary }: ConsentSummaryProps) {
  const questionTypeInfo = questionTypes.find((type) => type.id === questionSummary.question.type);

  const ctr: ChoiceResult = useMemo(() => {
    const total = questionSummary.responses.length;
    const clickedAbs = questionSummary.responses.filter((response) => response.value !== "dismissed").length;
    if (total === 0) {
      return { count: 0, acceptedCount: 0, acceptedPercentage: 0, dismissedCount: 0, dismissedPercentage: 0 };
    }
    return {
      count: total,
      acceptedCount: clickedAbs,
      acceptedPercentage: clickedAbs / total,
      dismissedCount: total - clickedAbs,
      dismissedPercentage: 1 - clickedAbs / total,
    };
  }, [questionSummary]);

  return (
    <div className=" rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
        <Headline headline={questionSummary.question.headline} required={questionSummary.question.required} />
        <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
          <div className=" flex items-center rounded-lg bg-slate-100 p-2">
            {questionTypeInfo && <questionTypeInfo.icon className="mr-2 h-4 w-4 " />}
            {questionTypeInfo ? questionTypeInfo.label : "Unknown Question Type"}
          </div>
          <div className=" flex items-center rounded-lg bg-slate-100 p-2">
            <InboxStackIcon className="mr-2 h-4 w-4 " />
            {ctr.count} responses
          </div>
        </div>
      </div>
      <div className="space-y-5 rounded-b-lg bg-white px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        <div>
          <div className="text flex justify-between px-2 pb-2">
            <div className="mr-8 flex space-x-1">
              <p className="font-semibold text-slate-700">Accepted</p>
              <div>
                <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                  {Math.round(ctr.acceptedPercentage * 100)}%
                </p>
              </div>
            </div>
            <p className="flex w-32 items-end justify-end text-slate-600">
              {ctr.acceptedCount} {ctr.acceptedCount === 1 ? "response" : "responses"}
            </p>
          </div>
          <ProgressBar barColor="bg-brand" progress={ctr.acceptedPercentage} />
        </div>
        <div>
          <div className="text flex justify-between px-2 pb-2">
            <div className="mr-8 flex space-x-1">
              <p className="font-semibold text-slate-700">Dismissed</p>
              <div>
                <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                  {Math.round(ctr.dismissedPercentage * 100)}%
                </p>
              </div>
            </div>
            <p className="flex w-32 items-end justify-end text-slate-600">
              {ctr.dismissedCount} {ctr.dismissedCount === 1 ? "response" : "responses"}
            </p>
          </div>
          <ProgressBar barColor="bg-brand" progress={ctr.dismissedPercentage} />
        </div>
      </div>
    </div>
  );
}
