import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { EditLanguage } from "@/modules/ee/multi-language-surveys/components/edit-language";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganization } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getUser } from "@formbricks/lib/user/service";

export const LanguagesPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();
  const project = await getProjectByEnvironmentId(params.environmentId);

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const organization = await getOrganization(project?.organizationId);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization.billing.plan);

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

  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);
  const { hasManageAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && !hasManageAccess;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation environmentId={params.environmentId} activeId="languages" />
      </PageHeader>
      <SettingsCard
        title={t("environments.project.languages.multi_language_surveys")}
        description={t("environments.project.languages.multi_language_surveys_description")}>
        <EditLanguage
          project={project}
          locale={user.locale}
          isReadOnly={isReadOnly}
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        />
      </SettingsCard>
    </PageContentWrapper>
  );
};
