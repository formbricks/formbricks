import { ChartsListPage } from "@/modules/ee/analysis/charts/components/charts-list-page";

const ChartsPage = async (props: Readonly<{ params: Promise<{ environmentId: string }> }>) => {
  const { environmentId } = await props.params;
  return <ChartsListPage environmentId={environmentId} />;
};

export default ChartsPage;
