import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { AccessView } from "@/modules/ee/teams/team-access/components/access-view";
import { getServerSession } from "next-auth";
import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { getTeamsByOranizationId, getTeamsByProductId } from "./lib/teams";

export const TeamAccess = async ({ params }: { params: { environmentId: string } }) => {
  const [product, session, organization] = await Promise.all([
    getProductByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!organization) {
    throw new Error("Organization not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isBilling, isMember } = getAccessFlags(currentUserMembership?.organizationRole);

  console.log("isBilling", isBilling, "isMember", isMember);
  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);

  const teams = await getTeamsByProductId(product.id);

  if (!teams) {
    throw new Error("Teams not found");
  }

  const organizationTeams = await getTeamsByOranizationId(organization.id);

  if (!organizationTeams) {
    throw new Error("Organization Teams not found");
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="access"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
        />
      </PageHeader>
      <AccessView
        environmentId={params.environmentId}
        organizationTeams={organizationTeams}
        teams={teams}
        product={product}
      />
    </PageContentWrapper>
  );
};
