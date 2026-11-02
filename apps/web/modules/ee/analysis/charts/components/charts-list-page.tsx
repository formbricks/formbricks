import { getAISmartToolsUnavailableReason, getOrganizationAIConfig } from "@/lib/ai/service";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { ChartsList } from "@/modules/ee/analysis/charts/components/charts-list";
import { CreateChartButton } from "@/modules/ee/analysis/charts/components/create-chart-button";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import { getFeedbackDataAvailability } from "@/modules/ee/analysis/lib/feedback-data-availability";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import { FeedbackDataEmptyState } from "@/modules/ee/unify-feedback/components/feedback-data-empty-state";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface ChartsListPageProps {
  workspaceId: string;
}

export async function ChartsListPage({ workspaceId }: Readonly<ChartsListPageProps>) {
  const t = await getTranslate();
  const { isReadOnly, organization, isOwner, isManager, session } = await getWorkspaceAuth(workspaceId);

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

  const [feedbackDataAvailability, aiConfig] = await Promise.all([
    getFeedbackDataAvailability(session.user.id, workspaceId),
    getOrganizationAIConfig(organization.id),
  ]);
  const aiUnavailableReason = getAISmartToolsUnavailableReason(aiConfig);
  const isAIAvailable = !aiUnavailableReason;

  if (feedbackDataAvailability.status === "no-directory") {
    return (
      <AnalysisPageLayout
        pageTitle={t("common.analysis")}
        workspaceId={workspaceId}
        cta={
          isReadOnly ? undefined : (
            <CreateChartButton
              workspaceId={workspaceId}
              directories={[]}
              buttonProps={{ disabled: true }}
              isAIAvailable={isAIAvailable}
              aiUnavailableReason={aiUnavailableReason}
            />
          )
        }>
        <FeedbackDataEmptyState
          variant="no-directory"
          organizationId={organization.id}
          isOwnerOrManager={isOwner || isManager}
        />
      </AnalysisPageLayout>
    );
  }

  const { directories, feedbackSources, hasFeedbackRecords } = feedbackDataAvailability;

  return (
    <AnalysisPageLayout
      pageTitle={t("common.analysis")}
      workspaceId={workspaceId}
      cta={
        isReadOnly ? undefined : (
          <CreateChartButton
            workspaceId={workspaceId}
            directories={directories}
            buttonProps={{ disabled: !hasFeedbackRecords }}
            isAIAvailable={isAIAvailable}
            aiUnavailableReason={aiUnavailableReason}
          />
        )
      }>
      {hasFeedbackRecords ? (
        <ChartsList
          workspaceId={workspaceId}
          isReadOnly={isReadOnly}
          directories={directories}
          isAIAvailable={isAIAvailable}
          aiUnavailableReason={aiUnavailableReason}
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
}
