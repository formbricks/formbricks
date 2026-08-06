import { DashboardDetailPage } from "@/modules/ee/analysis/dashboards/pages/dashboard-detail-page";

const Page = (
  props: Readonly<{
    params: Promise<{ workspaceId: string; dashboardId: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }>
) => {
  return <DashboardDetailPage params={props.params} searchParams={props.searchParams} />;
};

export default Page;
