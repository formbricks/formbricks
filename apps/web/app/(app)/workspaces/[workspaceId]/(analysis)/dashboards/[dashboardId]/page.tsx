import { DashboardDetailPage } from "@/modules/ee/analysis/dashboards/pages/dashboard-detail-page";

const Page = (props: { params: Promise<{ workspaceId: string; dashboardId: string }> }) => {
  return <DashboardDetailPage params={props.params} />;
};

export default Page;
