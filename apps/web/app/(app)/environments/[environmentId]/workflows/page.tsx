import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/user/service";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { WorkflowsPage } from "./components/workflows-page";

export const metadata: Metadata = {
  title: "Workflows",
};

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const { session, organization, isBilling } = await getEnvironmentAuth(params.environmentId);

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  const user = await getUser(session.user.id);
  if (!user) {
    return redirect("/auth/login");
  }

  return (
    <WorkflowsPage
      userEmail={user.email}
      organizationName={organization.name}
      billingPlan={organization.billing.plan}
    />
  );
};

export default Page;
