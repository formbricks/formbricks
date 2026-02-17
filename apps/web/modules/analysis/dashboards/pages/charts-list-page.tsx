import { ChartsListClient } from "../components/charts-list-client";
import { getCharts, getDashboards } from "../lib/data";

export async function ChartsListPage({ params }: { params: Promise<{ environmentId: string }> }) {
  const { environmentId } = await params;
  const [charts, dashboards] = await Promise.all([getCharts(environmentId), getDashboards(environmentId)]);

  return <ChartsListClient charts={charts} dashboards={dashboards} environmentId={environmentId} />;
}
