import { DashboardDetailPage } from "@/modules/ee/analysis/dashboards/pages/dashboard-detail-page";

const Page = (props: { params: Promise<{ environmentId: string; dashboardId: string }> }) => {
  return <DashboardDetailPage params={props.params} />;
};

export default Page;
