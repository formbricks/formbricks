import { TeamsPage } from "@/modules/organization/settings/teams/page";

const Page = (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  return TeamsPage(props);
};

export default Page;
