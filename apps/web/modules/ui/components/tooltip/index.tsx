"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { ReactNode } from "react";
import { cn } from "@formbricks/lib/cn";

const TooltipProvider: React.ComponentType<TooltipPrimitive.TooltipProviderProps> = TooltipPrimitive.Provider;

const Tooltip: React.ComponentType<TooltipPrimitive.TooltipProps> = ({ ...props }) => (
  <TooltipPrimitive.Root {...props} />
);
Tooltip.displayName = TooltipPrimitive.Tooltip.displayName;

const TooltipTrigger: React.ComponentType<TooltipPrimitive.TooltipTriggerProps> = TooltipPrimitive.Trigger;

const TooltipContent: React.ComponentType<TooltipPrimitive.TooltipContentProps> = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "animate-in fade-in-50 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 z-50 overflow-hidden rounded-md border border-slate-100 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-md",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

interface TooltipRendererProps {
  tooltipContent: ReactNode;
  children: ReactNode;
  className?: string;
  triggerClass?: string;
  shouldRender?: boolean;
}
export const TooltipRenderer = (props: TooltipRendererProps) => {
  const { children, shouldRender = true, tooltipContent, className, triggerClass } = props;
  if (shouldRender) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={triggerClass}>{children}</span>
          </TooltipTrigger>
          <TooltipContent className={className}>{tooltipContent}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <>{children}</>;
};
