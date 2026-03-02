import { notFound } from "next/navigation";
import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { env } from "@/lib/env";
import { getMonthlyOrganizationResponseCount } from "@/lib/organization/service";
import { getOrganizationProjectsCount } from "@/lib/project/service";
import { getTranslate } from "@/lingodotdev/server";
import { getOrganizationBillingWithReadThroughSync } from "@/modules/billing/lib/organization-billing";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { PricingTable } from "./components/pricing-table";

export const PricingPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();

  const { organization, isMember, currentUserMembership } = await getEnvironmentAuth(params.environmentId);

  if (!IS_FORMBRICKS_CLOUD) {
    notFound();
  }

  const syncedBilling = await getOrganizationBillingWithReadThroughSync(organization.id);
  const organizationWithSyncedBilling = {
    ...organization,
    billing: (syncedBilling ?? organization.billing) as typeof organization.billing,
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
        stripePublishableKey={env.STRIPE_PUBLISHABLE_KEY ?? null}
        stripePricingTableId={env.STRIPE_PRICING_TABLE_ID ?? null}
      />
    </PageContentWrapper>
  );
};
