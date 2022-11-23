import clsx from "clsx";

interface LegendProps {
  legendClassName?: string;
  children: React.ReactNode;
}

export function Legend({ legendClassName, children }: LegendProps) {
  return <legend className={clsx("formbricks-legend", legendClassName)}>{children}</legend>;
}
