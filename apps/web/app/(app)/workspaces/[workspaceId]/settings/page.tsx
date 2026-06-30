import { redirect } from "next/navigation";
import { redirectBillingRoleFromRestrictedSettings } from "@/app/(app)/workspaces/[workspaceId]/settings/lib/redirect-billing-role";

const Page = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const params = await props.params;
  await redirectBillingRoleFromRestrictedSettings(params.workspaceId);
  return redirect(`/workspaces/${params.workspaceId}/settings/workspace/general`);
};

export default Page;
