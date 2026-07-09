import { use } from "react";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import { getFeedbackDataAvailability } from "@/modules/ee/analysis/lib/feedback-data-availability";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import { FeedbackDataEmptyState } from "@/modules/ee/unify-feedback/components/feedback-data-empty-state";
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
  const { isReadOnly, organization, isOwner, isManager } = await getWorkspaceAuth(workspaceId);

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
                  ? `/organizations/${organization.id}/settings/billing`
                  : ENTERPRISE_LICENSE_REQUEST_FORM_URL,
              },
              {
                text: t("common.learn_more"),
                href: "https://formbricks.com/docs/unify-feedback/features/dashboards-and-charts",
              },
            ]}
          />
        </div>
      </AnalysisPageLayout>
    );
  }

  const feedbackDataAvailability = await getFeedbackDataAvailability(workspaceId);

  if (feedbackDataAvailability.status === "no-directory") {
    return (
      <AnalysisPageLayout
        pageTitle={t("common.analysis")}
        workspaceId={workspaceId}
        cta={isReadOnly ? undefined : <CreateDashboardButton workspaceId={workspaceId} disabled={true} />}>
        <FeedbackDataEmptyState
          variant="no-directory"
          organizationId={organization.id}
          isOwnerOrManager={isOwner || isManager}
        />
      </AnalysisPageLayout>
    );
  }

  const { feedbackSources, hasFeedbackRecords } = feedbackDataAvailability;
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
        <FeedbackDataEmptyState
          variant="no-records"
          workspaceId={workspaceId}
          hasFeedbackSources={feedbackSources.length > 0}
        />
      )}
    </AnalysisPageLayout>
  );
};
