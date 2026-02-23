import { ChartsList } from "@/modules/ee/analysis/charts/components/charts-list";
import { CreateChartButton } from "@/modules/ee/analysis/charts/components/create-chart-button";
import { getCharts } from "@/modules/ee/analysis/charts/lib/charts";

interface ChartsListPageProps {
  environmentId: string;
}

export async function ChartsListPage({ environmentId }: Readonly<ChartsListPageProps>) {
  const charts = await getCharts(environmentId);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateChartButton environmentId={environmentId} />
      </div>
      <ChartsList charts={charts} environmentId={environmentId} />
    </div>
  );
}
