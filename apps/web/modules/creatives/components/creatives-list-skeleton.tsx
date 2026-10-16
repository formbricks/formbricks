"use client";

import { useTranslation } from "react-i18next";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { Skeleton } from "@/modules/ui/components/skeleton";

// The list's loading states, built like the workflows list's (`WorkflowsListBodyLoading`) on the
// creatives grid: name over two columns, then status, type, opens, created, updated and creator.

/** While the first page of rows loads, under a toolbar that is already there. */
export const CreativesListBodySkeleton = () => (
  <div className="space-y-3">
    <div className="mt-6 grid w-full grid-cols-8 place-items-center gap-3 px-6 pr-8">
      <Skeleton className="col-span-2 h-4 w-full rounded-md" />
      {[0, 1, 2, 3, 4, 5].map((cell) => (
        <Skeleton key={cell} className="col-span-1 h-4 w-full rounded-md" />
      ))}
    </div>
    {[0, 1, 2].map((row) => (
      <div
        key={row}
        className="grid w-full grid-cols-8 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-8">
        <div className="col-span-2 w-full">
          <Skeleton className="h-4 w-44 rounded-md" />
        </div>
        <Skeleton className="col-span-1 h-6 w-20 rounded-full" />
        {[0, 1, 2, 3, 4].map((cell) => (
          <Skeleton key={cell} className="col-span-1 h-4 w-full rounded-md" />
        ))}
      </div>
    ))}
  </div>
);

/** The route's loading state: the page header and toolbar the list renders, then the rows. */
export const CreativesListSkeleton = () => {
  const { t } = useTranslation();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.creatives")} />
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-x-2">
            <Skeleton className="h-8 w-80 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
          <Skeleton className="h-8 w-40 rounded-md" />
        </div>
        <CreativesListBodySkeleton />
      </div>
    </PageContentWrapper>
  );
};
