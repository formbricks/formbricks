import { ResourceNotFoundError } from "@formbricks/types/errors";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { cn } from "@/lib/cn";
import { IS_STORAGE_CONFIGURED, SURVEY_BG_COLORS, UNSPLASH_ACCESS_KEY } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getTranslate } from "@/lingodotdev/server";
import { getRemoveBrandingPermission } from "@/modules/ee/license-check/lib/utils";
import { BrandingSettingsCard } from "@/modules/ee/whitelabel/remove-branding/components/branding-settings-card";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { WorkspaceConfigNavigation } from "@/modules/workspaces/settings/components/workspace-config-navigation";
import { EditLogo } from "@/modules/workspaces/settings/look/components/edit-logo";
import { getWorkspaceByEnvironmentId } from "@/modules/workspaces/settings/look/lib/workspace";
import { EditPlacementForm } from "./components/edit-placement-form";
import { ThemeStyling } from "./components/theme-styling";

export const WorkspaceLookSettingsPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { isReadOnly, organization } = await getEnvironmentAuth(params.environmentId);

  const workspace = await getWorkspaceByEnvironmentId(params.environmentId);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const canRemoveBranding = await getRemoveBrandingPermission(organization.id);
  const publicDomain = getPublicDomain();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workspace_configuration")}>
        <WorkspaceConfigNavigation environmentId={params.environmentId} activeId="look" />
      </PageHeader>
      {!IS_STORAGE_CONFIGURED && (
        <Alert variant="warning">
          <AlertDescription>{t("common.storage_not_configured")}</AlertDescription>
        </Alert>
      )}
      <SettingsCard
        title={t("environments.workspace.look.theme")}
        className={cn(!isReadOnly && "max-w-7xl")}
        description={t("environments.workspace.look.theme_settings_description")}>
        <ThemeStyling
          environmentId={params.environmentId}
          workspace={workspace}
          colors={SURVEY_BG_COLORS}
          isUnsplashConfigured={!!UNSPLASH_ACCESS_KEY}
          isReadOnly={isReadOnly}
          isStorageConfigured={IS_STORAGE_CONFIGURED}
          publicDomain={publicDomain}
        />
      </SettingsCard>
      <SettingsCard
        title={t("common.logo")}
        description={t("environments.workspace.look.logo_settings_description")}>
        <EditLogo
          workspace={workspace}
          environmentId={params.environmentId}
          isReadOnly={isReadOnly}
          isStorageConfigured={IS_STORAGE_CONFIGURED}
        />
      </SettingsCard>
      <SettingsCard
        title={t("environments.workspace.look.app_survey_placement")}
        description={t("environments.workspace.look.app_survey_placement_settings_description")}>
        <EditPlacementForm
          workspace={workspace}
          environmentId={params.environmentId}
          isReadOnly={isReadOnly}
        />
      </SettingsCard>

      <BrandingSettingsCard
        canRemoveBranding={canRemoveBranding}
        workspace={workspace}
        environmentId={params.environmentId}
        isReadOnly={isReadOnly}
      />
    </PageContentWrapper>
  );
};
