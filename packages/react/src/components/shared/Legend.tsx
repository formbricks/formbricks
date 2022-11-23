import clsx from "clsx";
import React from "react";

interface LegendProps {
  legendClassName?: string;
  children: React.ReactNode;
}

export function Legend({ legendClassName, children }: LegendProps) {
  return <legend className={clsx("formbricks-legend", legendClassName)}>{children}</legend>;
}
