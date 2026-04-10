"use client";

import { useTranslation } from "react-i18next";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { SkeletonLoader } from "@/modules/ui/components/skeleton-loader";

const Loading = () => {
  const { t } = useTranslation();
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.summary")} />
      <div className="flex h-9 animate-pulse gap-2">
        <div className="h-9 w-36 rounded-full bg-slate-200"></div>
        <div className="h-9 w-36 rounded-full bg-slate-200"></div>
        <div className="h-9 w-36 rounded-full bg-slate-200"></div>
        <div className="h-9 w-36 rounded-full bg-slate-200"></div>
      </div>
      <SkeletonLoader type="summary" />
    </PageContentWrapper>
  );
};

export default Loading;
