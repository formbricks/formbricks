import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { getServerSession } from "next-auth";
import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }: { params: { environmentId: string } }) => {
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

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="general"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
        />
      </PageHeader>
    </PageContentWrapper>
  );
};

export default Page;
