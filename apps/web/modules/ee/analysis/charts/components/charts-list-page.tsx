import { use } from "react";
import { getAISmartToolsUnavailableReason, getOrganizationAIConfig } from "@/lib/ai/service";
import { getConnectorsWithMappings } from "@/lib/connector/service";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { ChartsList } from "@/modules/ee/analysis/charts/components/charts-list";
import { CreateChartButton } from "@/modules/ee/analysis/charts/components/create-chart-button";
import type { TAIUnavailableReason } from "@/modules/ee/analysis/charts/lib/ai-availability";
import { getChartsWithCreator } from "@/modules/ee/analysis/charts/lib/charts";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import { NoFeedbackRecordsState } from "@/modules/ee/analysis/components/no-feedback-records-state";
import { hasFeedbackRecordsInDirectories } from "@/modules/ee/analysis/lib/feedback-records";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface ChartsListContentProps {
  chartsPromise: Promise<TChartWithCreator[]>;
  workspaceId: string;
  isReadOnly: boolean;
  directories: { id: string; name: string }[];
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

const ChartsListContent = ({
  chartsPromise,
  workspaceId,
  isReadOnly,
  directories,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<ChartsListContentProps>) => {
  const charts = use(chartsPromise);

  return (
    <ChartsList
      charts={charts}
      workspaceId={workspaceId}
      isReadOnly={isReadOnly}
      directories={directories}
      isAIAvailable={isAIAvailable}
      aiUnavailableReason={aiUnavailableReason}
    />
  );
};

interface ChartsListPageProps {
  workspaceId: string;
}

export async function ChartsListPage({ workspaceId }: Readonly<ChartsListPageProps>) {
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

  const [directories, connectors, aiConfig] = await Promise.all([
    getFeedbackDirectoriesByWorkspaceId(workspaceId),
    getConnectorsWithMappings(workspaceId),
    getOrganizationAIConfig(organization.id),
  ]);
  const aiUnavailableReason = getAISmartToolsUnavailableReason(aiConfig);
  const isAIAvailable = !aiUnavailableReason;
  const hasFeedbackRecords = await hasFeedbackRecordsInDirectories(
    directories.map((directory) => directory.id)
  );
  const chartsPromise = hasFeedbackRecords ? getChartsWithCreator(workspaceId) : null;

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
      {hasFeedbackRecords && chartsPromise ? (
        <ChartsListContent
          chartsPromise={chartsPromise}
          workspaceId={workspaceId}
          isReadOnly={isReadOnly}
          directories={directories}
          isAIAvailable={isAIAvailable}
          aiUnavailableReason={aiUnavailableReason}
        />
      ) : (
        <NoFeedbackRecordsState workspaceId={workspaceId} hasFeedbackSources={connectors.length > 0} />
      )}
    </AnalysisPageLayout>
  );
}
