import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { getRoleManagementPermission } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { PRODUCT_FEATURE_KEYS, STRIPE_PRICE_LOOKUP_KEYS } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import {
  getMonthlyActiveOrganizationPeopleCount,
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@formbricks/lib/organization/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { PricingTable } from "./components/PricingTable";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslations();
  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error(t("common.not_authorized"));
  }

  const [peopleCount, responseCount] = await Promise.all([
    getMonthlyActiveOrganizationPeopleCount(organization.id),
    getMonthlyOrganizationResponseCount(organization.id),
  ]);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);
  const hasBillingRights = !isMember;

  const canDoRoleManagement = await getRoleManagementPermission(organization);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          activeId="billing"
          canDoRoleManagement={canDoRoleManagement}
        />
      </PageHeader>

      <PricingTable
        organization={organization}
        environmentId={params.environmentId}
        peopleCount={peopleCount}
        responseCount={responseCount}
        stripePriceLookupKeys={STRIPE_PRICE_LOOKUP_KEYS}
        productFeatureKeys={PRODUCT_FEATURE_KEYS}
        hasBillingRights={hasBillingRights}
      />
    </PageContentWrapper>
  );
};

export default Page;
