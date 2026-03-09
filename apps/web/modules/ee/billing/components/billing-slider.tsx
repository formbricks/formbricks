"use client";

import { cn } from "@/lib/cn";

interface BillingSliderProps {
  className?: string;
  value: number;
  max: number;
}

export const BillingSlider = ({ className, value, max }: BillingSliderProps) => {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-slate-200", className)}>
      <div
        style={{ width: `${percentage}%` }}
        className={cn("h-full rounded-full transition-all", percentage >= 90 ? "bg-red-500" : "bg-slate-800")}
      />
    </div>
  );
};
