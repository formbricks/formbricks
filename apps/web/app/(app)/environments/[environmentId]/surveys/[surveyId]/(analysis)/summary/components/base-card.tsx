"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { cn } from "@/modules/ui/lib/utils";
import { ReactNode } from "react";

interface BaseCardProps {
  label: ReactNode;
  percentage?: number | null;
  tooltipText?: ReactNode;
  isLoading?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  testId?: string;
  id?: string;
}

export const BaseCard = ({
  label,
  percentage = null,
  tooltipText,
  isLoading = false,
  onClick,
  children,
  className,
  testId,
  id,
}: BaseCardProps) => {
  const isClickable = !!onClick;

  return (
    <TooltipProvider delayDuration={50}>
      <Tooltip>
        <TooltipTrigger onClick={onClick} data-testid={testId}>
          <div
            className={cn(
              "flex h-full flex-col justify-between space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm",
              isClickable ? "cursor-pointer" : "cursor-default",
              className
            )}
            id={id}>
            <p className="flex items-center gap-1 text-sm text-slate-600">
              {label}
              {typeof percentage === "number" &&
                !isNaN(percentage) &&
                Number.isFinite(percentage) &&
                !isLoading && (
                  <span className="ml-1 rounded-xl bg-slate-100 px-2 py-1 text-xs">
                    {Math.round(percentage)}%
                  </span>
                )}
            </p>
            {children}
          </div>
        </TooltipTrigger>
        {tooltipText && (
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};
