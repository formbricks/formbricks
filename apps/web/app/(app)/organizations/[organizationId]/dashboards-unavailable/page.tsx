import { DashboardsUnavailablePage } from "@/modules/ee/analysis/dashboards/pages/dashboards-unavailable-page";

const Page = (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => (
  <DashboardsUnavailablePage params={props.params} />
);

export default Page;
