import { use } from "react";
import { getTranslate } from "@/lingodotdev/server";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import { NoFeedbackRecordsState } from "@/modules/ee/analysis/components/no-feedback-records-state";
import { hasWorkspaceFeedbackRecords } from "@/modules/ee/analysis/lib/feedback-records";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { TDashboardWithCount } from "../../types/analysis";
import { CreateDashboardButton } from "../components/create-dashboard-button";
import { DashboardsTable } from "../components/dashboards-table";
import { getDashboards } from "../lib/dashboards";

interface DashboardsListContentProps {
  dashboardsPromise: Promise<TDashboardWithCount[]>;
  workspaceId: string;
  isReadOnly: boolean;
}

const DashboardsListContent = ({
  dashboardsPromise,
  workspaceId,
  isReadOnly,
}: Readonly<DashboardsListContentProps>) => {
  const dashboards = use(dashboardsPromise);

  return <DashboardsTable dashboards={dashboards} workspaceId={workspaceId} isReadOnly={isReadOnly} />;
};

interface DashboardsListPageProps {
  workspaceId: string;
}

export const DashboardsListPage = async ({ workspaceId }: Readonly<DashboardsListPageProps>) => {
  const t = await getTranslate();
  const { isReadOnly } = await getWorkspaceAuth(workspaceId);

  const hasFeedbackRecords = await hasWorkspaceFeedbackRecords(workspaceId);
  const dashboardsPromise = hasFeedbackRecords ? getDashboards(workspaceId) : null;

  return (
    <AnalysisPageLayout
      pageTitle={t("common.dashboards")}
      workspaceId={workspaceId}
      cta={
        isReadOnly ? undefined : (
          <CreateDashboardButton workspaceId={workspaceId} disabled={!hasFeedbackRecords} />
        )
      }>
      {hasFeedbackRecords && dashboardsPromise ? (
        <DashboardsListContent
          dashboardsPromise={dashboardsPromise}
          workspaceId={workspaceId}
          isReadOnly={isReadOnly}
        />
      ) : (
        <NoFeedbackRecordsState workspaceId={workspaceId} />
      )}
    </AnalysisPageLayout>
  );
};
