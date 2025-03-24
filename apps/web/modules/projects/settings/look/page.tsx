import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getWhiteLabelPermission } from "@/modules/ee/license-check/lib/utils";
import { BrandingSettingsCard } from "@/modules/ee/whitelabel/remove-branding/components/branding-settings-card";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { EditLogo } from "@/modules/projects/settings/look/components/edit-logo";
import { getProjectByEnvironmentId } from "@/modules/projects/settings/look/lib/project";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { cn } from "@formbricks/lib/cn";
import { SURVEY_BG_COLORS, UNSPLASH_ACCESS_KEY } from "@formbricks/lib/constants";
import { EditPlacementForm } from "./components/edit-placement-form";
import { ThemeStyling } from "./components/theme-styling";

export const ProjectLookSettingsPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { isReadOnly, organization } = await getEnvironmentAuth(params.environmentId);

  const project = await getProjectByEnvironmentId(params.environmentId);

  if (!project) {
    throw new Error("Project not found");
  }

  const canRemoveBranding = await getWhiteLabelPermission(organization.billing.plan);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation environmentId={params.environmentId} activeId="look" />
      </PageHeader>
      <SettingsCard
        title={t("environments.project.look.theme")}
        className={cn(!isReadOnly && "max-w-7xl")}
        description={t("environments.project.look.theme_settings_description")}>
        <ThemeStyling
          environmentId={params.environmentId}
          project={project}
          colors={SURVEY_BG_COLORS}
          isUnsplashConfigured={!!UNSPLASH_ACCESS_KEY}
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
