import { use } from "react";
import { getConnectorsWithMappings } from "@/lib/connector/service";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import { NoFeedbackRecordsState } from "@/modules/ee/analysis/components/no-feedback-records-state";
import { hasWorkspaceFeedbackRecords } from "@/modules/ee/analysis/lib/feedback-records";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
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
  const { isReadOnly, organization } = await getWorkspaceAuth(workspaceId);

  const isDashboardsAllowed = await getIsDashboardsEnabled(organization.id);
  if (!isDashboardsAllowed) {
    return (
      <AnalysisPageLayout pageTitle={t("common.analysis")} workspaceId={workspaceId}>
        <div className="flex items-center justify-center">
          <UpgradePrompt
            title={t("workspace.analysis.dashboards.upgrade_prompt_title")}
            description={t("workspace.analysis.dashboards.upgrade_prompt_description")}
            feature="dashboards"
            buttons={[
              {
                text: IS_FORMBRICKS_CLOUD ? t("common.upgrade_plan") : t("common.request_trial_license"),
                href: IS_FORMBRICKS_CLOUD
                  ? `/workspaces/${workspaceId}/settings/organization/billing`
                  : "https://formbricks.com/upgrade-self-hosting-license",
              },
              {
                text: t("common.learn_more"),
                href: IS_FORMBRICKS_CLOUD
                  ? `/workspaces/${workspaceId}/settings/organization/billing`
                  : "https://formbricks.com/learn-more-self-hosting-license",
              },
            ]}
          />
        </div>
      </AnalysisPageLayout>
    );
  }

  const [hasFeedbackRecords, connectors] = await Promise.all([
    hasWorkspaceFeedbackRecords(workspaceId),
    getConnectorsWithMappings(workspaceId),
  ]);
  const dashboardsPromise = hasFeedbackRecords ? getDashboards(workspaceId) : null;

  return (
    <AnalysisPageLayout
      pageTitle={t("common.analysis")}
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
        <NoFeedbackRecordsState workspaceId={workspaceId} hasFeedbackSources={connectors.length > 0} />
      )}
    </AnalysisPageLayout>
  );
};
