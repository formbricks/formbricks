import { redirect } from "next/navigation";
import { TCloudBillingPlan } from "@formbricks/types/organizations";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getPostHogFeatureFlag } from "@/lib/posthog/get-feature-flag";
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

  // Users with an existing paid/trial subscription should not be shown the trial page.
  // Redirect them directly to the next onboarding step.
  const billing = await getOrganizationBillingWithReadThroughSync(params.organizationId);
  const currentPlan = billing?.stripe?.plan;
  const hasExistingSubscription = currentPlan !== undefined && PAID_PLANS.has(currentPlan);

  if (hasExistingSubscription) {
    return redirect(`/organizations/${params.organizationId}/workspaces/new/survey`);
  }

  const [featureFlagValue, ctaFlagValue] = await Promise.all([
    getPostHogFeatureFlag(session.user.id, "a-b_onboarding_trial-conversion-screen-feature-copy", {
      organizationId: params.organizationId,
    }),
    getPostHogFeatureFlag(session.user.id, "a-b_onboarding_trial-conversion-screen-cta", {
      organizationId: params.organizationId,
    }),
  ]);

  const featureVariant = featureFlagValue === "variant_b" ? "variant_b" : "control";
  const ctaVariant =
    ctaFlagValue === "variant_b" || ctaFlagValue === "variant_c" || ctaFlagValue === "variant_d"
      ? ctaFlagValue
      : "control";

  return (
    <SelectPlanOnboarding
      organizationId={params.organizationId}
      featureVariant={featureVariant}
      ctaVariant={ctaVariant}
    />
  );
};

export default Page;
