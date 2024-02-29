import { TimerIcon } from "lucide-react";

import { TSurveySummary } from "@formbricks/types/responses";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

interface SummaryDropOffsProps {
  dropoff: TSurveySummary["dropoff"];
}

export default function SummaryDropOffs({ dropoff }: SummaryDropOffsProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="rounded-b-lg bg-white ">
        <div className="grid h-10 grid-cols-6 items-center border-y border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
          <div className="col-span-3 pl-4 md:pl-6">Questions</div>
          <div className="flex justify-center">
            <TooltipProvider delayDuration={50}>
              <Tooltip>
                <TooltipTrigger>
                  <TimerIcon className="h-5 w-5" />
                </TooltipTrigger>
                <TooltipContent side={"top"}>
                  <p className="text-center font-normal">Average time to complete each question.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="px-4 text-center md:px-6">Views</div>
          <div className="pr-6 text-center md:pl-6">Drop Offs</div>
        </div>
        {dropoff.map((quesDropoff) => (
          <div
            key={quesDropoff.questionId}
            className="grid grid-cols-6 items-center border-b border-slate-100 py-2 text-sm text-slate-800 md:text-base">
            <div className="col-span-3 pl-4 md:pl-6">{quesDropoff.headline}</div>
            <div className="whitespace-pre-wrap text-center font-semibold">
              {quesDropoff.ttc > 0 ? (quesDropoff.ttc / 1000).toFixed(2) + "s" : "N/A"}
            </div>
            <div className="whitespace-pre-wrap text-center font-semibold">{quesDropoff.views}</div>
            <div className=" pl-6 text-center md:px-6">
              <span className="font-semibold">{quesDropoff.dropoffCount}</span>
              <span>({Math.round(quesDropoff.dropoffPercentage)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
