import { use } from "react";
import { getTranslate } from "@/lingodotdev/server";
import { ChartsList } from "@/modules/ee/analysis/charts/components/charts-list";
import { CreateChartButton } from "@/modules/ee/analysis/charts/components/create-chart-button";
import { getChartsWithCreator } from "@/modules/ee/analysis/charts/lib/charts";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";

interface ChartsListContentProps {
  chartsPromise: Promise<TChartWithCreator[]>;
  environmentId: string;
  isReadOnly: boolean;
}

const ChartsListContent = ({
  chartsPromise,
  environmentId,
  isReadOnly,
}: Readonly<ChartsListContentProps>) => {
  const charts = use(chartsPromise);

  return <ChartsList charts={charts} environmentId={environmentId} isReadOnly={isReadOnly} />;
};

interface ChartsListPageProps {
  environmentId: string;
}

export async function ChartsListPage({ environmentId }: Readonly<ChartsListPageProps>) {
  const t = await getTranslate();
  const { project, isReadOnly } = await getEnvironmentAuth(environmentId);
  const chartsPromise = getChartsWithCreator(project.id);

  return (
    <AnalysisPageLayout
      pageTitle={t("common.analysis")}
      environmentId={environmentId}
      cta={isReadOnly ? undefined : <CreateChartButton environmentId={environmentId} />}>
      <ChartsListContent
        chartsPromise={chartsPromise}
        environmentId={environmentId}
        isReadOnly={isReadOnly}
      />
    </AnalysisPageLayout>
  );
}
