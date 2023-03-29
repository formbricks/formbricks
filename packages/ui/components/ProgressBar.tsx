"use client";

import { cn } from "@formbricks/lib/cn";

export function ProgressBar({ progress, barColor }: { progress: number; barColor?: string }) {
  return (
    <div className="h-5 w-full rounded-full bg-slate-200 ">
      <div
        className={cn("h-5 rounded-full", barColor)}
        style={{ width: `${Math.floor(progress * 100)}%` }}></div>
    </div>
  );
}
