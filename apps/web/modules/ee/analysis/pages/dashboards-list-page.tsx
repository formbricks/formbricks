import { Suspense } from "react";
import { DashboardsListClient } from "../components/dashboards-list-client";
import { DashboardsListSkeleton } from "../components/dashboards-list-skeleton";
import { getDashboards } from "../lib/data";

async function DashboardsListContent({ environmentId }: { environmentId: string }) {
  const dashboards = await getDashboards(environmentId);
  return <DashboardsListClient dashboards={dashboards} environmentId={environmentId} />;
}

export async function DashboardsListPage({ params }: { params: Promise<{ environmentId: string }> }) {
  const { environmentId } = await params;

  return (
    <Suspense fallback={<DashboardsListSkeleton />}>
      <DashboardsListContent environmentId={environmentId} />
    </Suspense>
  );
}
