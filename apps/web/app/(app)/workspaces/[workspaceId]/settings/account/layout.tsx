import { redirectBillingRoleFromRestrictedSettings } from "@/app/(app)/workspaces/[workspaceId]/settings/lib/redirect-billing-role";

const AccountSettingsLayout = async (props: {
  params: Promise<{ workspaceId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;
  await redirectBillingRoleFromRestrictedSettings(params.workspaceId);
  return <>{props.children}</>;
};

export default AccountSettingsLayout;
