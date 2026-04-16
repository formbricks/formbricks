import { DashboardsListPage } from "@/modules/ee/analysis/dashboards/pages/dashboards-list-page";

const DashboardsPage = async (props: Readonly<{ params: Promise<{ environmentId: string }> }>) => {
  const { environmentId } = await props.params;
  return <DashboardsListPage environmentId={environmentId} />;
};

export default DashboardsPage;
