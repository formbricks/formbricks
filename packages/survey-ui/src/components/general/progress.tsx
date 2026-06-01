import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends Omit<React.ComponentProps<"div">, "children"> {
  value?: number;
}

function Progress({ className, value, ...props }: Readonly<ProgressProps>): React.JSX.Element {
  const progressValue: number = typeof value === "number" ? value : 0;
  const indicatorRef = React.useRef<HTMLDivElement>(null);

  // Setting the translate value via setProperty (CSSOM) rather than the
  // `style` JSX prop keeps the HTML free of inline `style="..."` attributes,
  // which the strictest Content Security Policies disallow.
  React.useLayoutEffect(() => {
    indicatorRef.current?.style.setProperty("--fb-progress-translate-x", `-${String(100 - progressValue)}%`);
  }, [progressValue]);

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={progressValue}
      className={cn("progress-track relative w-full overflow-hidden", className)}
      {...props}>
      <ProgressPrimitive.Indicator
        ref={indicatorRef}
        data-slot="progress-indicator"
        className="progress-indicator h-full w-full flex-1 translate-x-(--fb-progress-translate-x,-100%) transition-all"
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
