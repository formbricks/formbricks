import { redirectBillingRoleFromRestrictedSettings } from "@/app/(app)/workspaces/[workspaceId]/settings/lib/redirect-billing-role";
import { TeamsPage } from "@/modules/organization/settings/teams/page";

const Page = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const params = await props.params;
  await redirectBillingRoleFromRestrictedSettings(params.workspaceId);

  return TeamsPage(props);
};

export default Page;
