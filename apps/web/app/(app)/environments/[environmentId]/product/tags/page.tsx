import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getServerSession } from "next-auth";
import { getMultiLanguagePermission, getRoleManagementPermission } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { getTagsOnResponsesCount } from "@formbricks/lib/tagOnResponse/service";
import { ErrorComponent } from "@formbricks/ui/components/ErrorComponent";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { EditTagsWrapper } from "./components/EditTagsWrapper";

const Page = async ({ params }) => {
  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error("Environment not found");
  }

  const [tags, environmentTagsCount, organization, session, product] = await Promise.all([
    getTagsByEnvironmentId(params.environmentId),
    getTagsOnResponsesCount(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
    getServerSession(authOptions),
    getProductByEnvironmentId(params.environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }
  if (!organization) {
    throw new Error("Organization not found");
  }

  if (!session) {
    throw new Error("Unauthenticated");
  }

  if (!product) {
    throw new Error("Product not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.organizationRole);

  const productPermission = await getProductPermissionByUserId(session.user.id, product.id);
  const { hasManageAccess } = getTeamPermissionFlags(productPermission);

  const isTagSettingDisabled = isMember && !hasManageAccess;

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  const canDoRoleManagement = await getRoleManagementPermission(organization);

  return !isTagSettingDisabled ? (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="tags"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          canDoRoleManagement={canDoRoleManagement}
        />
      </PageHeader>
      <SettingsCard title="Manage Tags" description="Merge and remove response tags.">
        <EditTagsWrapper
          environment={environment}
          environmentTags={tags}
          environmentTagsCount={environmentTagsCount}
        />
      </SettingsCard>
    </PageContentWrapper>
  ) : (
    <ErrorComponent />
  );
};

export default Page;
