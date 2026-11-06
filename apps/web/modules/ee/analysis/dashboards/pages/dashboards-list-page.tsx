import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import { getDashboardsPageAuth } from "@/modules/ee/analysis/lib/dashboards-page-auth";
import { getFeedbackDataAvailability } from "@/modules/ee/analysis/lib/feedback-data-availability";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import { FeedbackDataEmptyState } from "@/modules/ee/unify-feedback/components/feedback-data-empty-state";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { CreateDashboardButton } from "../components/create-dashboard-button";
import { DashboardsTable } from "../components/dashboards-table";

interface DashboardsListPageProps {
  workspaceId: string;
}

export const DashboardsListPage = async ({ workspaceId }: Readonly<DashboardsListPageProps>) => {
  const t = await getTranslate();
  const { isReadOnly, organizationId, isOwnerOrManager, isDashboardViewer, userId } =
    await getDashboardsPageAuth(workspaceId);

  const isDashboardsAllowed = await getIsDashboardsEnabled(organizationId);
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
                  ? `/organizations/${organizationId}/settings/billing`
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

  // A Dashboard viewer sees the workspace's dashboards and nothing about its Feedback Datasets, which
  // they may not read (ADR-0025): no data-source empty states, no Create, no Charts tab.
  if (isDashboardViewer) {
    return (
      <AnalysisPageLayout
        pageTitle={t("common.dashboards")}
        workspaceId={workspaceId}
        hideSecondaryNavigation>
        <DashboardsTable workspaceId={workspaceId} isReadOnly />
      </AnalysisPageLayout>
    );
  }

  const feedbackDataAvailability = await getFeedbackDataAvailability(userId, workspaceId);

  if (feedbackDataAvailability.status === "no-directory") {
    return (
      <AnalysisPageLayout
        pageTitle={t("common.analysis")}
        workspaceId={workspaceId}
        cta={isReadOnly ? undefined : <CreateDashboardButton workspaceId={workspaceId} disabled={true} />}>
        <FeedbackDataEmptyState
          variant="no-directory"
          organizationId={organizationId}
          isOwnerOrManager={isOwnerOrManager}
        />
      </AnalysisPageLayout>
    );
  }

  const { feedbackSources, hasFeedbackRecords } = feedbackDataAvailability;

  return (
    <AnalysisPageLayout
      pageTitle={t("common.analysis")}
      workspaceId={workspaceId}
      cta={
        isReadOnly ? undefined : (
          <CreateDashboardButton workspaceId={workspaceId} disabled={!hasFeedbackRecords} />
        )
      }>
      {hasFeedbackRecords ? (
        <DashboardsTable workspaceId={workspaceId} isReadOnly={isReadOnly} />
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
