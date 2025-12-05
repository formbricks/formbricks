"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as React from "react";
import { cn } from "../lib/utils";

interface ProgressProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Progress value (0-100) */
  value?: number;
  /** Custom inline styles for the progress indicator */
  indicatorStyle?: React.CSSProperties;
  /** Custom inline styles for the progress track */
  trackStyle?: React.CSSProperties;
}

function Progress({
  className,
  value,
  indicatorStyle,
  trackStyle,
  ...props
}: ProgressProps): React.JSX.Element {
  const progressValue: number = typeof value === "number" ? value : 0;
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("bg-primary/20 relative h-2 w-full overflow-hidden rounded-full", className)}
      style={trackStyle}
      {...props}>
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="bg-primary h-full w-full flex-1 transition-all"
        style={{ transform: `translateX(-${String(100 - progressValue)}%)`, ...indicatorStyle }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
