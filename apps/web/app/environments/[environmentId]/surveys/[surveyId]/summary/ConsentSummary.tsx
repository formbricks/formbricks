import { ConsentQuestion } from "@formbricks/types/questions";
import type { QuestionSummary } from "@formbricks/types/responses";
import { ProgressBar } from "@formbricks/ui";
import { InboxStackIcon } from "@heroicons/react/24/solid";

interface ConsentSummaryProps {
  questionSummary: QuestionSummary<ConsentQuestion>;
}

interface ChoiceResult {
  count: number;
  acceptedCount: number;
  acceptedPercentage: number;
  dismissedCount: number;
  dismissedPercentage: number;
}

export default function ConsentSummary({ questionSummary }: ConsentSummaryProps) {
  const total = questionSummary.responses.length;
  const clickedAbs = questionSummary.responses.filter((response) => response.value !== "dismissed").length;
  const ctr: ChoiceResult = {
    count: total,
    acceptedCount: clickedAbs,
    acceptedPercentage: clickedAbs / total,
    dismissedCount: total - clickedAbs,
    dismissedPercentage: 1 - clickedAbs / total,
  };

  return (
    <div className=" rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-6 pb-5 pt-6">
        <div>
          <h3 className="pb-1 text-xl font-semibold text-slate-900">{questionSummary.question.headline}</h3>
        </div>
        <div className="flex space-x-2 font-semibold text-slate-600">
          <div className="rounded-lg bg-slate-100 p-2 text-sm">Consent</div>
          <div className=" flex items-center rounded-lg bg-slate-100 p-2 text-sm">
            <InboxStackIcon className="mr-2 h-4 w-4 " />
            {ctr.count} responses
          </div>
        </div>
      </div>
      <div className="space-y-5 rounded-b-lg bg-white px-6 pb-6 pt-4">
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
