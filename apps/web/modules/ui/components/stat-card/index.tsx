"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

export const StatCard = ({ label, percentage, value, tooltipText, isLoading }) => {
  return (
    <TooltipProvider delayDuration={50}>
      <Tooltip>
        <TooltipTrigger>
          <div className="flex h-full cursor-default flex-col justify-between space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
            <p className="flex items-center gap-1 text-sm text-slate-600">
              {label}
              {typeof percentage === "number" && !isNaN(percentage) && !isLoading && (
                <span className="ml-1 rounded-xl bg-slate-100 px-2 py-1 text-xs">{percentage}%</span>
              )}
            </p>
            {isLoading ? (
              <div className="h-6 w-12 animate-pulse rounded-full bg-slate-200"></div>
            ) : (
              <p className="text-2xl font-bold text-slate-800">{value}</p>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
