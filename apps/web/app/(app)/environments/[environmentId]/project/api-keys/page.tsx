import { ProjectConfigNavigation } from "@/app/(app)/environments/[environmentId]/project/components/ProjectConfigNavigation";
import {
  getMultiLanguagePermission,
  getRoleManagementPermission,
} from "@/modules/ee/license-check/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { EnvironmentNotice } from "@formbricks/ui/components/EnvironmentNotice";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { SettingsCard } from "../../settings/components/SettingsCard";
import { ApiKeyList } from "./components/ApiKeyList";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslations();
  const [session, environment, organization, product] = await Promise.all([
    getServerSession(authOptions),
    getEnvironment(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
    getProjectByEnvironmentId(params.environmentId),
  ]);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  const locale = await findMatchingLocale();

  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const productPermission = await getProjectPermissionByUserId(session.user.id, product.id);
  const { hasManageAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && !hasManageAccess;

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  const canDoRoleManagement = await getRoleManagementPermission(organization);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.configuration")}>
        <ProjectConfigNavigation
          environmentId={params.environmentId}
          activeId="api-keys"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          canDoRoleManagement={canDoRoleManagement}
        />
      </PageHeader>
      <EnvironmentNotice environmentId={environment.id} subPageUrl="/product/api-keys" />
      {environment.type === "development" ? (
        <SettingsCard
          title={t("environments.product.api-keys.dev_api_keys")}
          description={t("environments.product.api-keys.dev_api_keys_description")}>
          <ApiKeyList
            environmentId={params.environmentId}
            environmentType="development"
            locale={locale}
            isReadOnly={isReadOnly}
          />
        </SettingsCard>
      ) : (
        <SettingsCard
          title={t("environments.product.api-keys.prod_api_keys")}
          description={t("environments.product.api-keys.prod_api_keys_description")}>
          <ApiKeyList
            environmentId={params.environmentId}
            environmentType="production"
            locale={locale}
            isReadOnly={isReadOnly}
          />
        </SettingsCard>
      )}
    </PageContentWrapper>
  );
};

export default Page;