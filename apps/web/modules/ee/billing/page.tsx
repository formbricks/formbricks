import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { notFound } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { PROJECT_FEATURE_KEYS, STRIPE_PRICE_LOOKUP_KEYS } from "@formbricks/lib/constants";
import {
  getMonthlyActiveOrganizationPeopleCount,
  getMonthlyOrganizationResponseCount,
} from "@formbricks/lib/organization/service";
import { getOrganizationProjectsCount } from "@formbricks/lib/project/service";
import { PricingTable } from "./components/pricing-table";

export const PricingPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();

  const { organization, isMember, currentUserMembership } = await getEnvironmentAuth(params.environmentId);

  if (!IS_FORMBRICKS_CLOUD) {
    notFound();
  }

  const [peopleCount, responseCount, projectCount] = await Promise.all([
    getMonthlyActiveOrganizationPeopleCount(organization.id),
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
        organization={organization}
        environmentId={params.environmentId}
        peopleCount={peopleCount}
        responseCount={responseCount}
        projectCount={projectCount}
        stripePriceLookupKeys={STRIPE_PRICE_LOOKUP_KEYS}
        projectFeatureKeys={PROJECT_FEATURE_KEYS}
        hasBillingRights={hasBillingRights}
      />
    </PageContentWrapper>
  );
};
