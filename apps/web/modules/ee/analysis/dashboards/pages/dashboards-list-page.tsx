import { Delay } from "@suspensive/react";
import { Suspense, use } from "react";
import { getTranslate } from "@/lingodotdev/server";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TDashboardWithCount } from "../../types/analysis";
import { CreateDashboardButton } from "../components/create-dashboard-button";
import { DashboardsListSkeleton } from "../components/dashboards-list-skeleton";
import { DashboardsTable } from "../components/dashboards-table";
import { getDashboards } from "../lib/dashboards";

interface DashboardsListContentProps {
  dashboardsPromise: Promise<TDashboardWithCount[]>;
  environmentId: string;
  isReadOnly: boolean;
}

const DashboardsListContent = ({
  dashboardsPromise,
  environmentId,
  isReadOnly,
}: Readonly<DashboardsListContentProps>) => {
  const dashboards = use(dashboardsPromise);

  return <DashboardsTable dashboards={dashboards} environmentId={environmentId} isReadOnly={isReadOnly} />;
};

interface DashboardsListPageProps {
  environmentId: string;
}

export const DashboardsListPage = async ({ environmentId }: Readonly<DashboardsListPageProps>) => {
  const t = await getTranslate();
  const { project, isReadOnly } = await getEnvironmentAuth(environmentId);

  const dashboardsPromise = getDashboards(project.id);

  return (
    <AnalysisPageLayout
      pageTitle={t("common.analysis")}
      environmentId={environmentId}
      cta={isReadOnly ? undefined : <CreateDashboardButton environmentId={environmentId} />}>
      <Suspense
        fallback={
          <Delay ms={200}>
            <DashboardsListSkeleton
              columnHeaders={[
                t("common.title"),
                t("common.charts"),
                t("common.created_by"),
                t("common.created"),
                t("common.updated"),
              ]}
            />
          </Delay>
        }>
        <DashboardsListContent
          dashboardsPromise={dashboardsPromise}
          environmentId={environmentId}
          isReadOnly={isReadOnly}
        />
      </Suspense>
    </AnalysisPageLayout>
  );
};
