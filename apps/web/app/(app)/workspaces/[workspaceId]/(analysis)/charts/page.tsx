import { ChartsListPage } from "@/modules/ee/analysis/charts/components/charts-list-page";

const ChartsPage = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const { workspaceId } = await props.params;
  return <ChartsListPage workspaceId={workspaceId} />;
};

export default ChartsPage;
