import { notFound } from "next/navigation";
import { getDashboard } from "../../lib/data";
import { DashboardDetailClient } from "./components/DashboardDetailClient";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ environmentId: string; dashboardId: string }>;
}) {
  const { environmentId, dashboardId } = await params;
  const dashboard = await getDashboard(environmentId, dashboardId);

  if (!dashboard) {
    return notFound();
  }

  return <DashboardDetailClient dashboard={dashboard} environmentId={environmentId} />;
}
