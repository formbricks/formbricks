import { ChartBuilderClient } from "./components/ChartBuilderClient";

interface ChartBuilderPageProps {
  params: Promise<{ environmentId: string }>;
  searchParams: Promise<{ chartId?: string }>;
}

export default async function ChartBuilderPage({ params, searchParams }: ChartBuilderPageProps) {
  const { environmentId } = await params;
  const { chartId } = await searchParams;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          {chartId ? "Edit chart" : "Create a new chart"}
        </h1>
      </div>
      <ChartBuilderClient environmentId={environmentId} chartId={chartId} />
    </>
  );
}
