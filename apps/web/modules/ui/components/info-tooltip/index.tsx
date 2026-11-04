"use client";

import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface InfoTooltipProps {
  /** What the tooltip explains; shown on hover and on keyboard focus. */
  readonly children: ReactNode;
  /** The button's accessible name, e.g. "About the Flow tab". */
  readonly label: string;
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly className?: string;
}

/**
 * An (i) button that explains the control next to it in a tooltip: help text that would otherwise sit
 * on the page as a paragraph, or why a button is disabled. A real button, so the explanation is
 * reachable by keyboard; it never submits or toggles what it sits in.
 */
export const InfoTooltip = ({ children, label, side = "top", className }: InfoTooltipProps) => (
  <TooltipProvider delayDuration={80}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden",
            className
          )}
          // Inside a row that toggles on click: explaining it must not open or close it.
          onClick={(event) => event.stopPropagation()}>
          <InfoIcon className="size-4" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs">
        {children}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
