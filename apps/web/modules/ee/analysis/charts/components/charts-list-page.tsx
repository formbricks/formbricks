import { use } from "react";
import { getConnectorsWithMappings } from "@/lib/connector/service";
import { getTranslate } from "@/lingodotdev/server";
import { ChartsList } from "@/modules/ee/analysis/charts/components/charts-list";
import { CreateChartButton } from "@/modules/ee/analysis/charts/components/create-chart-button";
import { getChartsWithCreator } from "@/modules/ee/analysis/charts/lib/charts";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import { NoFeedbackRecordsState } from "@/modules/ee/analysis/components/no-feedback-records-state";
import { hasFeedbackRecordsInDirectories } from "@/modules/ee/analysis/lib/feedback-records";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";
import { getFeedbackRecordDirectoriesByWorkspaceId } from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

interface ChartsListContentProps {
  chartsPromise: Promise<TChartWithCreator[]>;
  workspaceId: string;
  isReadOnly: boolean;
  directories: { id: string; name: string }[];
}

const ChartsListContent = ({
  chartsPromise,
  workspaceId,
  isReadOnly,
  directories,
}: Readonly<ChartsListContentProps>) => {
  const charts = use(chartsPromise);

  return (
    <ChartsList charts={charts} workspaceId={workspaceId} isReadOnly={isReadOnly} directories={directories} />
  );
};

interface ChartsListPageProps {
  workspaceId: string;
}

export async function ChartsListPage({ workspaceId }: Readonly<ChartsListPageProps>) {
  const t = await getTranslate();
  const { isReadOnly } = await getWorkspaceAuth(workspaceId);
  const [directories, connectors] = await Promise.all([
    getFeedbackRecordDirectoriesByWorkspaceId(workspaceId),
    getConnectorsWithMappings(workspaceId),
  ]);
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
          />
        )
      }>
      {hasFeedbackRecords && chartsPromise ? (
        <ChartsListContent
          chartsPromise={chartsPromise}
          workspaceId={workspaceId}
          isReadOnly={isReadOnly}
          directories={directories}
        />
      ) : (
        <NoFeedbackRecordsState workspaceId={workspaceId} hasFeedbackSources={connectors.length > 0} />
      )}
    </AnalysisPageLayout>
  );
}
