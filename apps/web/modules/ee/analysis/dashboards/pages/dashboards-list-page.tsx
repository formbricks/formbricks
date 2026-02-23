import { Delay } from "@suspensive/react";
import { Suspense } from "react";
import { getTranslate } from "@/lingodotdev/server";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { CreateDashboardButton } from "../components/create-dashboard-button";
import { DashboardsListSkeleton } from "../components/dashboards-list-skeleton";
import { DashboardsTable } from "../components/dashboards-table";
import { getDashboards } from "../lib/dashboards";

interface DashboardsListContentProps {
  projectId: string;
  environmentId: string;
  isReadOnly: boolean;
}

const DashboardsListContent = async ({
  projectId,
  environmentId,
  isReadOnly,
}: Readonly<DashboardsListContentProps>) => {
  const dashboards = await getDashboards(projectId);

  return <DashboardsTable dashboards={dashboards} environmentId={environmentId} isReadOnly={isReadOnly} />;
};

export const DashboardsListPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const { environmentId } = await props.params;
  const t = await getTranslate();
  const { project, isReadOnly } = await getEnvironmentAuth(environmentId);

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
        <DashboardsListContent projectId={project.id} environmentId={environmentId} isReadOnly={isReadOnly} />
      </Suspense>
    </AnalysisPageLayout>
  );
};
