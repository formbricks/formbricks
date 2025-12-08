"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends Omit<React.ComponentProps<"div">, "children"> {
  value?: number;
}

function Progress({ className, value, ...props }: ProgressProps): React.JSX.Element {
  const progressValue: number = typeof value === "number" ? value : 0;
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={progressValue}
      className={cn("relative w-full overflow-hidden", className)}
      style={{
        height: "var(--fb-progress-track-height)",
        backgroundColor: "var(--fb-progress-track-bg-color)",
        borderRadius: "var(--fb-progress-track-border-radius)",
      }}
      {...props}>
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 transition-all"
        style={{
          transform: `translateX(-${String(100 - progressValue)}%)`,
          backgroundColor: "var(--fb-progress-indicator-bg-color)",
          borderRadius: "var(--fb-progress-indicator-border-radius)",
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
