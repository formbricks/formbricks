import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getMultiLanguagePermission, getRoleManagementPermission } from "@formbricks/ee/lib/service";
import { EditLanguage } from "@formbricks/ee/multi-language/components/edit-language";
import { authOptions } from "@formbricks/lib/authOptions";
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
        <EditLanguage product={product} locale={user.locale} />
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
