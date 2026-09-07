import { redirect } from "next/navigation";
import { TCloudBillingPlan } from "@formbricks/types/organizations";
import { getOnboardingWorkspace } from "@/app/(app)/(onboarding)/lib/onboarding-workspace";
import { redirectIfOnboardingComplete } from "@/app/(app)/(onboarding)/lib/redirect-if-onboarding-complete";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getOrganizationBillingWithReadThroughSync } from "@/modules/ee/billing/lib/organization-billing";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { SelectPlanOnboarding } from "./components/select-plan-onboarding";

const PAID_PLANS = new Set<TCloudBillingPlan>(["pro", "scale", "custom"]);

interface PlanPageProps {
  params: Promise<{
    organizationId: string;
  }>;
}

const Page = async (props: PlanPageProps) => {
  const params = await props.params;

  if (!IS_FORMBRICKS_CLOUD) {
    return redirect(`/organizations/${params.organizationId}/workspaces/new/survey`);
  }

  const { session } = await getOrganizationAuth(params.organizationId);

  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const workspace = await getOnboardingWorkspace(session.user.id, params.organizationId);
  if (workspace) {
    await redirectIfOnboardingComplete(workspace.id);
  }

  // Users with an existing paid/trial subscription should not be shown the trial page.
  // Redirect them directly to the next onboarding step.
  const billing = await getOrganizationBillingWithReadThroughSync(params.organizationId);
  const currentPlan = billing?.stripe?.plan;
  const hasExistingSubscription = currentPlan !== undefined && PAID_PLANS.has(currentPlan);

  if (hasExistingSubscription) {
    return redirect(`/organizations/${params.organizationId}/workspaces/new/survey`);
  }

  return <SelectPlanOnboarding organizationId={params.organizationId} />;
};

export default Page;
