import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { EnvironmentNotice } from "@/modules/ui/components/environment-notice";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { ApiKeyList } from "./components/api-key-list";

export const APIKeysPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();
  const [session, environment, organization, project] = await Promise.all([
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

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);
  const { hasManageAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && !hasManageAccess;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation environmentId={params.environmentId} activeId="api-keys" />
      </PageHeader>
      <EnvironmentNotice environmentId={environment.id} subPageUrl="/project/api-keys" />
      {environment.type === "development" ? (
        <SettingsCard
          title={t("environments.project.api-keys.dev_api_keys")}
          description={t("environments.project.api-keys.dev_api_keys_description")}>
          <ApiKeyList
            environmentId={params.environmentId}
            environmentType="development"
            locale={locale}
            isReadOnly={isReadOnly}
          />
        </SettingsCard>
      ) : (
        <SettingsCard
          title={t("environments.project.api-keys.prod_api_keys")}
          description={t("environments.project.api-keys.prod_api_keys_description")}>
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
