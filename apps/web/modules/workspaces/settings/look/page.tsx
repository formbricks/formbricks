import { ResourceNotFoundError } from "@formbricks/types/errors";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { cn } from "@/lib/cn";
import { IS_STORAGE_CONFIGURED, SURVEY_BG_COLORS, UNSPLASH_ACCESS_KEY } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getWorkspace } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { getRemoveBrandingPermission } from "@/modules/ee/license-check/lib/utils";
import { BrandingSettingsCard } from "@/modules/ee/whitelabel/remove-branding/components/branding-settings-card";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { EditLogo } from "@/modules/workspaces/settings/look/components/edit-logo";
import { EditPlacementForm } from "./components/edit-placement-form";
import { ThemeStyling } from "./components/theme-styling";

export const WorkspaceLookSettingsPage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { isReadOnly, organization } = await getWorkspaceAuth(params.workspaceId);

  const workspace = await getWorkspace(params.workspaceId);

  if (!workspace) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  const canRemoveBranding = await getRemoveBrandingPermission(organization.id);
  const publicDomain = getPublicDomain();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.look_and_feel")} />
      {!IS_STORAGE_CONFIGURED && (
        <Alert variant="warning">
          <AlertDescription>{t("common.storage_not_configured")}</AlertDescription>
        </Alert>
      )}
      <SettingsCard
        title={t("workspace.look.theme")}
        className={cn(!isReadOnly && "max-w-7xl")}
        description={t("workspace.look.theme_settings_description")}>
        <ThemeStyling
          workspaceId={params.workspaceId}
          workspace={workspace}
          colors={SURVEY_BG_COLORS}
          isUnsplashConfigured={!!UNSPLASH_ACCESS_KEY}
          isReadOnly={isReadOnly}
          isStorageConfigured={IS_STORAGE_CONFIGURED}
          publicDomain={publicDomain}
        />
      </SettingsCard>
      <SettingsCard title={t("common.logo")} description={t("workspace.look.logo_settings_description")}>
        <EditLogo
          workspace={workspace}
          workspaceId={params.workspaceId}
          isReadOnly={isReadOnly}
          isStorageConfigured={IS_STORAGE_CONFIGURED}
        />
      </SettingsCard>
      <SettingsCard
        title={t("workspace.look.app_survey_placement")}
        description={t("workspace.look.app_survey_placement_settings_description")}>
        <EditPlacementForm workspace={workspace} isReadOnly={isReadOnly} />
      </SettingsCard>

      <BrandingSettingsCard
        canRemoveBranding={canRemoveBranding}
        workspace={workspace}
        isReadOnly={isReadOnly}
      />
    </PageContentWrapper>
  );
};
