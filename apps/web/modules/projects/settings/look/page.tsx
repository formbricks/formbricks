import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { authOptions } from "@/modules/auth/lib/authOptions";
import {
  getMultiLanguagePermission,
  getRoleManagementPermission,
  getWhiteLabelPermission,
} from "@/modules/ee/license-check/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { BrandingSettingsCard } from "@/modules/ee/whitelabel/remove-branding/components/branding-settings-card";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { EditLogo } from "@/modules/projects/settings/look/components/edit-logo";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { cn } from "@formbricks/lib/cn";
import { DEFAULT_LOCALE, SURVEY_BG_COLORS, UNSPLASH_ACCESS_KEY } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getUserLocale } from "@formbricks/lib/user/service";
import { EditPlacementForm } from "./components/edit-placement-form";
import { ThemeStyling } from "./components/theme-styling";

export const ProjectLookSettingsPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslations();
  const [session, organization, project] = await Promise.all([
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(params.environmentId),
    getProjectByEnvironmentId(params.environmentId),
  ]);

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }
  const locale = session?.user.id ? await getUserLocale(session.user.id) : undefined;
  const canRemoveBranding = await getWhiteLabelPermission(organization);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);
  const { hasManageAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && !hasManageAccess;

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  const canDoRoleManagement = await getRoleManagementPermission(organization);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.configuration")}>
        <ProjectConfigNavigation
          environmentId={params.environmentId}
          activeId="look"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          canDoRoleManagement={canDoRoleManagement}
        />
      </PageHeader>
      <SettingsCard
        title={t("environments.project.look.theme")}
        className={cn(!isReadOnly && "max-w-7xl")}
        description={t("environments.project.look.theme_settings_description")}>
        <ThemeStyling
          environmentId={params.environmentId}
          project={project}
          colors={SURVEY_BG_COLORS}
          isUnsplashConfigured={UNSPLASH_ACCESS_KEY ? true : false}
          locale={locale ?? DEFAULT_LOCALE}
          isReadOnly={isReadOnly}
        />
      </SettingsCard>
      <SettingsCard
        title={t("common.logo")}
        description={t("environments.project.look.logo_settings_description")}>
        <EditLogo project={project} environmentId={params.environmentId} isReadOnly={isReadOnly} />
      </SettingsCard>
      <SettingsCard
        title={t("environments.project.look.app_survey_placement")}
        description={t("environments.project.look.app_survey_placement_settings_description")}>
        <EditPlacementForm project={project} environmentId={params.environmentId} isReadOnly={isReadOnly} />
      </SettingsCard>

      <BrandingSettingsCard
        canRemoveBranding={canRemoveBranding}
        project={project}
        environmentId={params.environmentId}
        isReadOnly={isReadOnly}
      />
    </PageContentWrapper>
  );
};
