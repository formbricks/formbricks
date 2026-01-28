import { getDashboards } from "../lib/data";
import { DashboardsListClient } from "./components/DashboardsListClient";

export default async function DashboardsListPage({
  params,
}: {
  params: Promise<{ environmentId: string }>;
}) {
  const { environmentId } = await params;
  const dashboards = await getDashboards(environmentId);

  return <DashboardsListClient dashboards={dashboards} environmentId={environmentId} />;
}
