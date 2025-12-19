import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends Omit<React.ComponentProps<"div">, "children"> {
  value?: number;
}

function Progress({ className, value, ...props }: Readonly<ProgressProps>): React.JSX.Element {
  const progressValue: number = typeof value === "number" ? value : 0;
  return (
    // @ts-expect-error - React types version mismatch - the project uses React 19 types, but some Radix UI packages (@radix-ui/react-progress) bundle their own older React types, creating incompatible Ref type definitions
    <ProgressPrimitive.Root
      data-slot="progress"
      value={progressValue}
      className={cn("progress-track relative w-full overflow-hidden", className)}
      {...props}>
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="progress-indicator h-full w-full flex-1 transition-all"
        style={{
          transform: `translateX(-${String(100 - progressValue)}%)`,
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
