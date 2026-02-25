import { ChartsListPage } from "@/modules/ee/analysis/charts/components/charts-list-page";

export default async function ChartsPage({ params }: { params: Promise<{ environmentId: string }> }) {
  const { environmentId } = await params;
  return <ChartsListPage environmentId={environmentId} />;
}
