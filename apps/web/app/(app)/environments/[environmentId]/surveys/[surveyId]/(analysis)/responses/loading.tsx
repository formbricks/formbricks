"use client";

import { useTranslation } from "react-i18next";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Loading = () => {
  const { t } = useTranslation();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.responses")} />
      {/* Filter bar placeholder */}
      <div className="flex h-9 animate-pulse gap-1.5">
        <div className="h-9 w-36 rounded-full bg-slate-200" />
        <div className="h-9 w-36 rounded-full bg-slate-200" />
      </div>
      {/* Toolbar placeholder */}
      <div className="flex animate-pulse items-center justify-between py-2">
        <div className="h-8 w-48 rounded-md bg-slate-200" />
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-md bg-slate-200" />
          <div className="h-8 w-8 rounded-md bg-slate-200" />
        </div>
      </div>
      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-slate-200">
        {/* Header row */}
        <div className="flex h-12 items-center gap-4 border-b border-slate-200 bg-slate-100 px-4">
          <div className="h-4 w-4 rounded bg-slate-200" />
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        </div>
        {/* Data rows */}
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="flex h-12 items-center gap-4 border-b border-slate-100 px-4 last:border-b-0">
            <div className="h-4 w-4 rounded bg-slate-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </PageContentWrapper>
  );
};

export default Loading;
