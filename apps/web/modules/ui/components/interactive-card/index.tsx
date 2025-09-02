"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

interface InteractiveCardProps {
  tab: "dropOffs" | "quotas";
  label: string;
  percentage: number;
  value: React.ReactNode;
  tooltipText: string;
  isLoading: boolean;
  onClick: () => void;
  isActive: boolean;
}

export const InteractiveCard = ({
  tab,
  label,
  percentage,
  value,
  tooltipText,
  isLoading,
  onClick,
  isActive,
}: InteractiveCardProps) => {
  return (
    <TooltipProvider delayDuration={50}>
      <Tooltip>
        <TooltipTrigger onClick={onClick} data-testid={`${tab}-toggle`}>
          <div
            className="flex h-full cursor-pointer flex-col justify-between space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"
            id={`${tab}-toggle`}>
            <span className="text-sm text-slate-600">
              {label}
              {`${Math.round(percentage)}%` !== "NaN%" && !isLoading && (
                <span className="ml-1 rounded-xl bg-slate-100 px-2 py-1 text-xs">{`${Math.round(percentage)}%`}</span>
              )}
            </span>
            <div className="flex w-full items-end justify-between">
              <span className="text-2xl font-bold text-slate-800">
                {isLoading ? <div className="h-6 w-12 animate-pulse rounded-full bg-slate-200"></div> : value}
              </span>
              {!isLoading && (
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100">
                  {isActive ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
