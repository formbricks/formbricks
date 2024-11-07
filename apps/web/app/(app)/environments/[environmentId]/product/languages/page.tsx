import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { EditLanguage } from "@/modules/ee/multi-language-surveys/components/edit-language";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getMultiLanguagePermission, getRoleManagementPermission } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganization } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getUser } from "@formbricks/lib/user/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }: { params: { environmentId: string } }) => {
  const t = await getTranslations();
  const product = await getProductByEnvironmentId(params.environmentId);

  if (!product) {
    throw new Error(t("environments.product.general.product_not_found"));
  }

  const organization = await getOrganization(product?.organizationId);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  if (!isMultiLanguageAllowed) {
    notFound();
  }

  const canDoRoleManagement = await getRoleManagementPermission(organization);

  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Session not found");
  }

  const user = await getUser(session.user.id);

  if (!user) {
    throw new Error("User not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const productPermission = await getProductPermissionByUserId(session.user.id, product.id);
  const { hasManageAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && !hasManageAccess;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.configuration")}>
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="languages"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          canDoRoleManagement={canDoRoleManagement}
        />
      </PageHeader>
      <SettingsCard
        title={t("environments.product.languages.multi_language_surveys")}
        description={t("environments.product.languages.multi_language_surveys_description")}>
        <EditLanguage product={product} locale={user.locale} isReadOnly={isReadOnly} />
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
