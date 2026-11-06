"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { InfoIcon } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { isElementCutOff } from "@/modules/ui/components/info-tooltip/lib/truncation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

type TSide = "top" | "right" | "bottom" | "left";
type TAlign = "start" | "center" | "end";

interface InfoTooltipContentProps {
  readonly children: ReactNode;
  readonly side?: TSide;
  readonly align?: TAlign;
  /**
   * The element the tooltip stays inside, e.g. the editor column: near its edge the tooltip flips to
   * the other side rather than cover what is next to it (ENG-6969 T12). Defaults to the viewport.
   */
  readonly collisionBoundary?: Element | null;
}

/**
 * The one look of every explanation on the Flow tab (ENG-6969 T12): dark, at most 300px wide, with an
 * arrow pointing at what it explains.
 */
export const InfoTooltipContent = ({
  children,
  side = "top",
  align = "center",
  collisionBoundary,
}: InfoTooltipContentProps) => (
  <TooltipContent
    side={side}
    align={align}
    collisionBoundary={collisionBoundary ?? undefined}
    collisionPadding={8}
    // The arrow sits outside the box: the default overflow-hidden would clip it.
    className="max-w-[300px] overflow-visible border-slate-900 bg-slate-900 px-2.5 py-1.5 text-xs leading-relaxed text-white">
    {children}
    <TooltipPrimitive.Arrow className="fill-slate-900" width={10} height={5} />
  </TooltipContent>
);

interface InfoTooltipProps extends Omit<InfoTooltipContentProps, "children"> {
  /** What the tooltip explains; shown on hover and on keyboard focus. */
  readonly children: ReactNode;
  /** The button's accessible name, e.g. "About the Flow tab". */
  readonly label: string;
  readonly className?: string;
}

/**
 * An (i) button that explains the control next to it in a tooltip: help text that would otherwise sit
 * on the page as a paragraph, or why a button is disabled. A real button, so the explanation is
 * reachable by keyboard; it never submits or toggles what it sits in.
 */
export const InfoTooltip = ({ children, label, className, ...contentProps }: InfoTooltipProps) => (
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
      <InfoTooltipContent {...contentProps}>{children}</InfoTooltipContent>
    </Tooltip>
  </TooltipProvider>
);

interface TruncationTooltipProps extends Omit<InfoTooltipContentProps, "children"> {
  /** The whole text, as plain words. Omitted: the line's own text, read as the tooltip opens. */
  readonly content?: ReactNode;
  /** The line that may be cut off. */
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * A one-line summary that shows its whole text in the info tooltip on hover, only while part of it is
 * cut off (ENG-6969 T2, `isElementCutOff`). The check runs as the tooltip opens rather than on render,
 * so a line resized since (a table column) still answers for its current width. Screen readers get
 * the whole text from the row's accessible name instead.
 */
export const TruncationTooltip = ({
  content,
  children,
  className,
  ...contentProps
}: TruncationTooltipProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [ownText, setOwnText] = useState("");
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip
        open={open}
        onOpenChange={(next) => {
          const text = content === undefined ? (ref.current?.textContent?.trim() ?? "") : "";
          setOwnText(text);
          setOpen(next && (content !== undefined || text !== "") && isElementCutOff(ref.current));
        }}>
        <TooltipTrigger asChild>
          <span ref={ref} className={className}>
            {children}
          </span>
        </TooltipTrigger>
        <InfoTooltipContent align="start" {...contentProps}>
          {content ?? ownText}
        </InfoTooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
