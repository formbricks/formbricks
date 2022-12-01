interface LegendProps {
  legendClassName?: string;
  children: React.ReactNode;
}

export function Legend({ legendClassName, children }: LegendProps) {
  return <legend className={legendClassName || "formbricks-legend"}>{children}</legend>;
}
