import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { getCloudBillingDisplayContext } from "@/modules/ee/billing/lib/cloud-billing-display";
import { getWorkspaceAuth } from "@/modules/environments/lib/utils";
import { WorkflowsPage } from "./components/workflows-page";

export const metadata: Metadata = {
  title: "Workflows",
};

const Page = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;

  if (!IS_FORMBRICKS_CLOUD) {
    return notFound();
  }

  const { session, organization, isBilling } = await getWorkspaceAuth(params.workspaceId);

  if (isBilling) {
    return redirect(`/workspaces/${params.workspaceId}/settings/billing`);
  }

  const user = await getUser(session.user.id);
  if (!user) {
    return redirect("/auth/login");
  }

  const cloudBillingDisplayContext = await getCloudBillingDisplayContext(organization.id);

  return (
    <WorkflowsPage
      userEmail={user.email}
      organizationName={organization.name}
      billingPlan={cloudBillingDisplayContext.currentCloudPlan}
    />
  );
};

export default Page;
