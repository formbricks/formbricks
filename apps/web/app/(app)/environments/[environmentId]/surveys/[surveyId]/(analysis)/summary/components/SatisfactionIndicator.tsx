interface SatisfactionIndicatorProps {
  percentage: number;
}

export const SatisfactionIndicator = ({ percentage }: SatisfactionIndicatorProps) => {
  let colorClass = "";

  if (percentage > 80) {
    colorClass = "bg-emerald-500";
  } else if (percentage >= 55) {
    colorClass = "bg-orange-500";
  } else {
    colorClass = "bg-rose-500";
  }

  return <div className={`h-3 w-3 rounded-full ${colorClass}`} />;
};
