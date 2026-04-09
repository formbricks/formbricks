import { notFound } from "next/navigation";
import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMonthlyOrganizationResponseCount } from "@/lib/organization/service";
import { getOrganizationProjectsCount } from "@/lib/project/service";
import { getTranslate } from "@/lingodotdev/server";
import { getCloudBillingDisplayContext } from "@/modules/ee/billing/lib/cloud-billing-display";
import { getStripeBillingCatalogDisplay } from "@/modules/ee/billing/lib/stripe-billing-catalog";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { PricingTable } from "./components/pricing-table";

export const PricingPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { organization, isMember, currentUserMembership } = await getEnvironmentAuth(params.environmentId);

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

  const [responseCount, projectCount] = await Promise.all([
    getMonthlyOrganizationResponseCount(organization.id),
    getOrganizationProjectsCount(organization.id),
  ]);

  const hasBillingRights = !isMember;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          activeId="billing"
        />
      </PageHeader>

      <PricingTable
        organization={organizationWithSyncedBilling}
        environmentId={params.environmentId}
        responseCount={responseCount}
        projectCount={projectCount}
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
      />
    </PageContentWrapper>
  );
};
