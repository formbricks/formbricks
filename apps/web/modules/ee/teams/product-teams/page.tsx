import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { authOptions } from "@/modules/auth/lib/authOptions";
import {
  getMultiLanguagePermission,
  getRoleManagementPermission,
} from "@/modules/ee/license-check/lib/utils";
import { AccessView } from "@/modules/ee/teams/product-teams/components/access-view";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTeamsByOrganizationId, getTeamsByProductId } from "./lib/teams";

export const ProductTeams = async (props: { params: Promise<{ environmentId: string }> }) => {
  const t = await getTranslations();
  const params = await props.params;
  const [product, session, organization] = await Promise.all([
    getProductByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!product) {
    throw new Error(t("common.product_not_found"));
  }
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isOwner, isManager } = getAccessFlags(currentUserMembership?.role);

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  const canDoRoleManagement = await getRoleManagementPermission(organization);

  const teams = await getTeamsByProductId(product.id);

  if (!teams) {
    throw new Error(t("common.teams_not_found"));
  }

  const organizationTeams = await getTeamsByOrganizationId(organization.id);

  if (!organizationTeams) {
    throw new Error(t("common.organization_teams_not_found"));
  }

  const isOwnerOrManager = isOwner || isManager;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.configuration")}>
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="teams"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          canDoRoleManagement={canDoRoleManagement}
        />
      </PageHeader>
      <AccessView
        environmentId={params.environmentId}
        organizationTeams={organizationTeams}
        teams={teams}
        product={product}
        isOwnerOrManager={isOwnerOrManager}
      />
    </PageContentWrapper>
  );
};
