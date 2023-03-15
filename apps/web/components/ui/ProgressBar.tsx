"use client";

import clsx from "clsx";

export default function ProgressBar({ progress, barColor }: { progress: number; barColor?: string }) {
  return (
    <div className="h-5 w-full rounded-full bg-slate-200 ">
      <div
        className={clsx("h-5 rounded-full", barColor)}
        style={{ width: `${Math.floor(progress * 100)}%` }}></div>
    </div>
  );
}
