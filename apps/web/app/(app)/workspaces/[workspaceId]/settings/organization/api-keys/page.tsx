import { redirectBillingRoleFromRestrictedSettings } from "@/app/(app)/workspaces/[workspaceId]/settings/lib/redirect-billing-role";
import { APIKeysPage } from "@/modules/organization/settings/api-keys/page";

const Page = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  await redirectBillingRoleFromRestrictedSettings(params.workspaceId);

  return APIKeysPage(props);
};

export default Page;
