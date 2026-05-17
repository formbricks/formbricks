import { redirect } from "next/navigation";
import { TCloudBillingPlan } from "@formbricks/types/organizations";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getPostHogFeatureFlag } from "@/lib/posthog/get-feature-flag";
import { getOrganizationBillingWithReadThroughSync } from "@/modules/ee/billing/lib/organization-billing";
import { PLAN_VARIANTS, type TPlanVariant } from "@/modules/ee/billing/lib/select-plan-variants";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { SelectPlanOnboarding } from "./components/select-plan-onboarding";

const PAID_PLANS = new Set<TCloudBillingPlan>(["pro", "scale", "custom"]);
const VALID_VARIANTS = new Set<TPlanVariant>(PLAN_VARIANTS);

interface PlanPageProps {
  params: Promise<{
    organizationId: string;
  }>;
}

const Page = async (props: PlanPageProps) => {
  const params = await props.params;

  if (!IS_FORMBRICKS_CLOUD) {
    return redirect(`/organizations/${params.organizationId}/workspaces/new/mode`);
  }

  const { session } = await getOrganizationAuth(params.organizationId);

  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  // Users with an existing paid/trial subscription should not be shown the trial page.
  // Redirect them directly to the next onboarding step.
  const billing = await getOrganizationBillingWithReadThroughSync(params.organizationId);
  const currentPlan = billing?.stripe?.plan;
  const hasExistingSubscription = currentPlan !== undefined && PAID_PLANS.has(currentPlan);

  if (hasExistingSubscription) {
    return redirect(`/organizations/${params.organizationId}/workspaces/new/mode`);
  }

  let variant: TPlanVariant = "control";
  const flagValue = await getPostHogFeatureFlag(
    session.user.id,
    "a-b_onboarding_trial-conversion-screen-copy",
    {
      organizationId: params.organizationId,
    }
  );
  if (typeof flagValue === "string" && VALID_VARIANTS.has(flagValue as TPlanVariant)) {
    variant = flagValue as TPlanVariant;
  }

  const selectPlanOnboardingProps = {
    organizationId: params.organizationId,
    variant,
  };

  return <SelectPlanOnboarding {...selectPlanOnboardingProps} />;
};

export default Page;
