import { notFound } from "next/navigation";
import { DashboardDetailClient } from "../components/dashboard-detail-client";
import { getDashboard } from "../lib/data";

export async function DashboardDetailPage({
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
