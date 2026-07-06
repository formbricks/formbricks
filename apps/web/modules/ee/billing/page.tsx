import { notFound } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { env } from "@/lib/env";
import { getMonthlyOrganizationResponseCount } from "@/lib/organization/service";
import { getPostHogFeatureFlag } from "@/lib/posthog/get-feature-flag";
import { getOrganizationWorkspacesCount } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { getCloudBillingDisplayContext } from "@/modules/ee/billing/lib/cloud-billing-display";
import { getStripeBillingCatalogDisplay } from "@/modules/ee/billing/lib/stripe-billing-catalog";
import { getBillingUsageOverview } from "@/modules/ee/billing/lib/usage-overview";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { PricingTable } from "./components/pricing-table";

export const PricingPage = async (props: { params: Promise<{ organizationId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { organization, isMember, session } = await getOrganizationAuth(params.organizationId);

  if (!IS_FORMBRICKS_CLOUD) {
    notFound();
  }

  const [cloudBillingDisplayContext, billingCatalog] = await Promise.all([
    getCloudBillingDisplayContext(organization.id),
    getStripeBillingCatalogDisplay(),
  ]);

  const organizationWithSyncedBilling = {
    ...organization,
    billing: cloudBillingDisplayContext.billing,
  };

  const [responseCount, workspaceCount, usageOverview, subscriptionRedesignFlag, planComparisonFlag] =
    await Promise.all([
      getMonthlyOrganizationResponseCount(organization.id),
      getOrganizationWorkspacesCount(organization.id),
      getBillingUsageOverview(organization.id),
      getPostHogFeatureFlag(session.user.id, "a-b_billing_usage-subscription-redesign"),
      getPostHogFeatureFlag(session.user.id, "a-b_billing_plan-comparison-table"),
    ]);

  const hasBillingRights = !isMember;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.billing")} />

      <PricingTable
        organization={organizationWithSyncedBilling}
        responseCount={responseCount}
        workspaceCount={workspaceCount}
        surveyCount={usageOverview.surveyCount}
        memberCount={usageOverview.memberCount}
        isSubscriptionRedesign={subscriptionRedesignFlag === "test"}
        isPlanComparison={planComparisonFlag === "test"}
        hasBillingRights={hasBillingRights}
        currentCloudPlan={cloudBillingDisplayContext.currentCloudPlan}
        currentBillingInterval={cloudBillingDisplayContext.currentBillingInterval}
        currentSubscriptionStatus={cloudBillingDisplayContext.currentSubscriptionStatus}
        pendingChange={cloudBillingDisplayContext.pendingChange}
        usageCycleStart={cloudBillingDisplayContext.usageCycleStart}
        usageCycleEnd={cloudBillingDisplayContext.usageCycleEnd}
        isStripeSetupIncomplete={!organizationWithSyncedBilling.billing.stripeCustomerId}
        trialDaysRemaining={cloudBillingDisplayContext.trialDaysRemaining}
        billingCatalog={billingCatalog}
        stripePublishableKey={env.STRIPE_PUBLISHABLE_KEY ?? null}
      />
    </PageContentWrapper>
  );
};
