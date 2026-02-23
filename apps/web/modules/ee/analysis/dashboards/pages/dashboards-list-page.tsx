import { Suspense } from "react";
import { getUser } from "@/lib/user/service";
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

  const userIds = [...new Set(dashboards.map((d) => d.createdBy).filter(Boolean) as string[])];
  const users = await Promise.all(userIds.map((id) => getUser(id)));
  const userMap = new Map(users.filter(Boolean).map((u) => [u!.id, u!.name]));

  return (
    <DashboardsTable
      dashboards={dashboards}
      environmentId={environmentId}
      isReadOnly={isReadOnly}
      userMap={userMap}
    />
  );
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
          <DashboardsListSkeleton
            columnHeaders={[
              t("common.title"),
              t("common.charts"),
              t("common.created_by"),
              t("common.created"),
              t("common.updated"),
            ]}
          />
        }>
        <DashboardsListContent projectId={project.id} environmentId={environmentId} isReadOnly={isReadOnly} />
      </Suspense>
    </AnalysisPageLayout>
  );
};
