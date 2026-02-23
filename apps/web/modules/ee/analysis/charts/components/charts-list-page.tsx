import { Delay } from "@suspensive/react";
import { Suspense, use } from "react";
import { getTranslate } from "@/lingodotdev/server";
import { ChartsList } from "@/modules/ee/analysis/charts/components/charts-list";
import { ChartsListSkeleton } from "@/modules/ee/analysis/charts/components/charts-list-skeleton";
import { CreateChartButton } from "@/modules/ee/analysis/charts/components/create-chart-button";
import { getCharts } from "@/modules/ee/analysis/charts/lib/charts";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";

interface ChartsListContentProps {
  chartsPromise: Promise<TChartWithCreator[]>;
  environmentId: string;
}

const ChartsListContent = ({ chartsPromise, environmentId }: Readonly<ChartsListContentProps>) => {
  const charts = use(chartsPromise);

  return <ChartsList charts={charts} environmentId={environmentId} />;
};

interface ChartsListPageProps {
  environmentId: string;
}

export async function ChartsListPage({ environmentId }: Readonly<ChartsListPageProps>) {
  const t = await getTranslate();
  const { isReadOnly } = await getEnvironmentAuth(environmentId);
  const chartsPromise = getCharts(environmentId);

  return (
    <AnalysisPageLayout
      pageTitle={t("common.analysis")}
      environmentId={environmentId}
      cta={isReadOnly ? undefined : <CreateChartButton environmentId={environmentId} />}>
      <Suspense
        fallback={
          <Delay ms={200}>
            <ChartsListSkeleton
              columnHeaders={[
                t("common.title"),
                t("common.created_by"),
                t("common.created_at"),
                t("common.updated_at"),
              ]}
            />
          </Delay>
        }>
        <ChartsListContent chartsPromise={chartsPromise} environmentId={environmentId} />
      </Suspense>
    </AnalysisPageLayout>
  );
}
