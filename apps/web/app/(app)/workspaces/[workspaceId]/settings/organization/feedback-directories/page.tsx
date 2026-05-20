import { redirectBillingRoleFromRestrictedSettings } from "@/app/(app)/workspaces/[workspaceId]/settings/lib/redirect-billing-role";
import { FeedbackDirectoriesPage } from "@/modules/ee/feedback-directory/page";

const Page = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const params = await props.params;
  await redirectBillingRoleFromRestrictedSettings(params.workspaceId);

  return FeedbackDirectoriesPage(props);
};

export default Page;
