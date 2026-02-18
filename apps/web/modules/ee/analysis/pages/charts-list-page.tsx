import { Suspense } from "react";
import { ChartsListClient } from "../components/charts-list-client";
import { ChartsListSkeleton } from "../components/charts-list-skeleton";
import { getCharts, getDashboards } from "../lib/data";

async function ChartsListContent({ environmentId }: { environmentId: string }) {
  const [charts, dashboards] = await Promise.all([getCharts(environmentId), getDashboards(environmentId)]);
  return <ChartsListClient charts={charts} dashboards={dashboards} environmentId={environmentId} />;
}

export async function ChartsListPage({ params }: { params: Promise<{ environmentId: string }> }) {
  const { environmentId } = await params;

  return (
    <Suspense fallback={<ChartsListSkeleton />}>
      <ChartsListContent environmentId={environmentId} />
    </Suspense>
  );
}
