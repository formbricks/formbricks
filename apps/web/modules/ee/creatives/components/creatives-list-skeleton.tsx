"use client";

import { useTranslation } from "react-i18next";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { Skeleton } from "@/modules/ui/components/skeleton";

/** The route's loading state: the page header, the shared toolbar's controls, then a few table rows. */
export const CreativesListSkeleton = () => {
  const { t } = useTranslation();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.creatives")} />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-8 w-64 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="flex items-center gap-6 border-b border-slate-100 px-4 py-4 last:border-0">
              <Skeleton className="h-4 w-56 rounded-md" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </PageContentWrapper>
  );
};
