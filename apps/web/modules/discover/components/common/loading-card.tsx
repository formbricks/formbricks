"use client";

import React from "react";

export function LoadingEngagementCard(): React.JSX.Element {
  const badgeStyle = "h-5 rounded-full bg-slate-200";

  return (
    <div className="relative my-4 flex w-full animate-pulse flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-h-[170px] p-6">
        <div className="mb-2 flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-16 ${badgeStyle} ${badgeStyle}`} />

            <div className={`w-24 ${badgeStyle}`} />
          </div>

          <div className={`w-24 ${badgeStyle}`} />
        </div>

        <div className="mb-2 h-6 w-3/4 rounded-md bg-slate-200" />

        <div className="mb-2 h-4 w-full rounded bg-slate-200" />
      </div>

      <div className="p-6 pt-0">
        <div className="mb-4 flex items-center">
          <div className="${badgeStyle} mr-2 h-6 w-6" />

          <div className="h-4 w-32 rounded bg-slate-200" />
        </div>

        <div className="h-10 w-full rounded-md bg-slate-200" />
      </div>
    </div>
  );
}

export default LoadingEngagementCard;
