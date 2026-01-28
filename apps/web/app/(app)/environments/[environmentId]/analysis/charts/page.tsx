import { getCharts, getDashboards } from "../lib/data";
import { ChartsListClient } from "./components/ChartsListClient";

export default async function ChartsListPage({
  params,
}: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await params;
  const [charts, dashboards] = await Promise.all([getCharts(environmentId), getDashboards(environmentId)]);

  return <ChartsListClient charts={charts} dashboards={dashboards} environmentId={environmentId} />;
}
