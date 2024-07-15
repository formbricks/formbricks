import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { PRODUCT_FEATURE_KEYS, STRIPE_PRICE_LOOKUP_KEYS } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import {
  getMonthlyActiveOrganizationPeopleCount,
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@formbricks/lib/organization/service";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";
import { PricingTable } from "./components/PricingTable";

const Page = async ({ params }) => {
  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  if (!organization) {
    throw new Error("Organization not found");
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Unauthorized");
  }

  const [peopleCount, responseCount] = await Promise.all([
    getMonthlyActiveOrganizationPeopleCount(organization.id),
    getMonthlyOrganizationResponseCount(organization.id),
  ]);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Organization Settings">
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
        stripePriceLookupKeys={STRIPE_PRICE_LOOKUP_KEYS}
        productFeatureKeys={PRODUCT_FEATURE_KEYS}
      />
    </PageContentWrapper>
  );
};

export default Page;
