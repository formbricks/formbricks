import { TimerIcon } from "lucide-react";
import { TSurveySummary } from "@formbricks/types/surveys/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

interface SummaryDropOffsProps {
  dropOff: TSurveySummary["dropOff"];
}

export const SummaryDropOffs = ({ dropOff }: SummaryDropOffsProps) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="">
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
          <div className="px-4 text-center md:px-6">Impressions</div>
          <div className="pr-6 text-center md:pl-6">Drop-Offs</div>
        </div>
        {dropOff.map((quesDropOff) => (
          <div
            key={quesDropOff.questionId}
            className="grid grid-cols-6 items-center border-b border-slate-100 py-2 text-sm text-slate-800 md:text-base">
            <div className="col-span-3 pl-4 md:pl-6">{quesDropOff.headline}</div>
            <div className="whitespace-pre-wrap text-center font-semibold">
              {quesDropOff.ttc > 0 ? (quesDropOff.ttc / 1000).toFixed(2) + "s" : "N/A"}
            </div>
            <div className="whitespace-pre-wrap text-center font-semibold">{quesDropOff.impressions}</div>
            <div className="pl-6 text-center md:px-6">
              <span className="mr-1.5 font-semibold">{quesDropOff.dropOffCount}</span>
              <span>({Math.round(quesDropOff.dropOffPercentage)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
