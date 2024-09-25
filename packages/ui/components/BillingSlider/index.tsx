import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "@formbricks/lib/cn";

interface SliderProps {
  className?: string;
  value: number;
  max: number;
  freeTierLimit: number;
  metric: string;
}

export const BillingSlider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, value, max, freeTierLimit, metric, ...props }, ref) => (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      {...props}>
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-r-full bg-slate-300">
        <div
          style={{ width: `calc(${Math.min(value / max, 0.93) * 100}%)` }}
          className="absolute h-full bg-slate-800"></div>
        <div
          style={{
            width: `${((freeTierLimit - value) / max) * 100}%`,
            left: `${(value / max) * 100}%`,
          }}
          className="absolute h-full bg-slate-400"></div>
      </SliderPrimitive.Track>

      <div
        style={{ left: `calc(${Math.min(value / max, 0.93) * 100}%)` }}
        className="absolute mt-4 h-6 w-px bg-slate-400"></div>

      <div
        style={{ left: `calc(${Math.min(value / max, 0.93) * 100}% + 0.5rem)` }}
        className="absolute mt-16 text-sm text-slate-700 dark:text-slate-200">
        <p className="text-xs">
          Current:
          <br />
          {value} {metric}
        </p>
      </div>

      <div
        style={{ left: `${(freeTierLimit / max) * 100}%` }}
        className="absolute mt-4 h-6 w-px bg-slate-300"></div>
      <div
        style={{ left: `calc(${(freeTierLimit / max) * 100}% + 0.5rem)` }}
        className="absolute mt-16 text-sm text-slate-700">
        <p className="text-xs">
          Current Tier Limit
          <br />
          {freeTierLimit} {metric}
        </p>
      </div>
    </SliderPrimitive.Root>
  )
);
BillingSlider.displayName = SliderPrimitive.Root.displayName;
