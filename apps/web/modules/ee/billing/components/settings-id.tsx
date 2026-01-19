"use client";

import { HelpCircleIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface SettingsIdProps {
  label: string;
  value: string;
  tooltip?: string;
  className?: string;
  align?: "left" | "right";
}

export const SettingsId = ({ label, value, tooltip, className, align = "left" }: SettingsIdProps) => {
  return (
    <div className={cn("flex flex-col", align === "right" && "items-end", className)}>
      <div className={cn("flex items-center gap-1", align === "right" && "flex-row-reverse")}>
        <span className="text-sm text-slate-500">{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircleIcon className="h-3.5 w-3.5 cursor-help text-slate-400" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span className="text-base font-medium text-slate-800">{value}</span>
    </div>
  );
};
