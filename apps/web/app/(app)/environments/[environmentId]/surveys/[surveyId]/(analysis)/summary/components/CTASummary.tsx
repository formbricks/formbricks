import Headline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/Headline";
import type { QuestionSummary } from "@formbricks/types/responses";
import { TSurveyCTAQuestion } from "@formbricks/types/v1/surveys";
import { ProgressBar } from "@formbricks/ui";
import { InboxStackIcon } from "@heroicons/react/24/solid";
import { useMemo } from "react";
import { questionTypes } from "@/lib/questions";

interface CTASummaryProps {
  questionSummary: QuestionSummary<TSurveyCTAQuestion>;
}

interface ChoiceResult {
  count: number;
  percentage: number;
}

export default function CTASummary({ questionSummary }: CTASummaryProps) {
  const questionTypeInfo = questionTypes.find((type) => type.id === questionSummary.question.type);

  const ctr: ChoiceResult = useMemo(() => {
    const clickedAbs = questionSummary.responses.filter((response) => response.value === "clicked").length;
    const count = questionSummary.responses.length;
    if (count === 0) return { count: 0, percentage: 0 };
    return {
      count: count,
      percentage: clickedAbs / count,
    };
  }, [questionSummary]);

  return (
    <div className=" rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
        <Headline headline={questionSummary.question.headline} required={questionSummary.question.required} />

        <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
          <div className=" flex items-center rounded-lg bg-slate-100 p-2 ">
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
        <div className="text flex justify-between px-2 pb-2">
          <div className="mr-8 flex space-x-1">
            <p className="font-semibold text-slate-700">Clickthrough Rate (CTR)</p>
            <div>
              <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                {Math.round(ctr.percentage * 100)}%
              </p>
            </div>
          </div>
          <p className="flex w-32 items-end justify-end text-slate-600">
            {ctr.count} {ctr.count === 1 ? "response" : "responses"}
          </p>
        </div>
        <ProgressBar barColor="bg-brand" progress={ctr.percentage} />
      </div>
    </div>
  );
}
