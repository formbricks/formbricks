import { ChartsList } from "../components/charts-list";
import { getCharts } from "../lib/data";

interface ChartsListPageProps {
  params: Promise<{ environmentId: string }>;
}

export async function ChartsListPage({ params }: Readonly<ChartsListPageProps>) {
  const { environmentId } = await params;
  const charts = await getCharts(environmentId);

  return <ChartsList charts={charts} environmentId={environmentId} />;
}
