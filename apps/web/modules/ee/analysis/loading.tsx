"use client";

import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AnalysisSecondaryNavigation } from "@/modules/ee/analysis/components/analysis-secondary-navigation";
import { DashboardsListSkeleton } from "@/modules/ee/analysis/dashboards/components/dashboards-list-skeleton";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

export const AnalysisListLoading = () => {
  const { t } = useTranslation();
  const params = useParams();
  const workspaceId = params?.workspaceId as string;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.dashboards")}>
        {workspaceId ? <AnalysisSecondaryNavigation workspaceId={workspaceId} /> : null}
      </PageHeader>
      <DashboardsListSkeleton
        columnHeaders={[
          t("common.title"),
          t("common.charts"),
          t("common.created_by"),
          t("common.created"),
          t("common.updated"),
        ]}
      />
    </PageContentWrapper>
  );
};
