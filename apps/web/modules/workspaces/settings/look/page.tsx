import { ResourceNotFoundError } from "@formbricks/types/errors";
import { sanitizeThemeStyling } from "@formbricks/types/styling-values";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { cn } from "@/lib/cn";
import {
  IS_FORMBRICKS_CLOUD,
  IS_STORAGE_CONFIGURED,
  SURVEY_BG_COLORS,
  UNSPLASH_ACCESS_KEY,
} from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getWorkspace } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { CustomCssQueryClientProvider } from "@/modules/custom-css/components/custom-css-query-client-provider";
import { hasStylesInHeadScripts } from "@/modules/custom-css/components/lib/hints";
import { type TWorkspaceCustomCssAccess } from "@/modules/custom-css/components/types";
import { getCustomCssPlanAllowed } from "@/modules/custom-css/lib/access";
import { getIsCustomCssRolledOut } from "@/modules/custom-css/lib/rollout";
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

  const { canManage, isOwner, isManager, organization } = await getWorkspaceAuth(params.workspaceId);
  // Every card on this page saves through an action that asserts `workspace.manage`.
  const isReadOnly = !canManage;

  const workspace = await getWorkspace(params.workspaceId);

  if (!workspace) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  const [canRemoveBranding, isCustomCssRolledOut, isCustomCssPlanAllowed] = await Promise.all([
    getRemoveBrandingPermission(organization.id),
    getIsCustomCssRolledOut(organization.id),
    getCustomCssPlanAllowed(organization.id),
  ]);
  const publicDomain = getPublicDomain();

  // Mirrors the server's checks for `PATCH …/custom-css` (ENG-2949), which stay authoritative. The
  // rollout flag only hides the card; it never decides what may be saved.
  const customCssAccess: TWorkspaceCustomCssAccess | null = isCustomCssRolledOut
    ? {
        canEdit: isOwner || isManager,
        planAllowed: isCustomCssPlanAllowed,
        // Head scripts exist only on self-hosted, and the check is a plain string match (ENG-3415).
        hasHeadScriptStyles: !IS_FORMBRICKS_CLOUD && hasStylesInHeadScripts(workspace.customHeadScripts),
        billingHref: IS_FORMBRICKS_CLOUD ? `/organizations/${organization.id}/settings/billing` : null,
      }
    : null;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.appearance")} />
      {!IS_STORAGE_CONFIGURED && (
        <Alert variant="warning" role="status">
          <AlertDescription>{t("common.storage_not_configured")}</AlertDescription>
        </Alert>
      )}
      <SettingsCard
        title={t("workspace.look.theme")}
        className={cn(!isReadOnly && "max-w-7xl")}
        description={t("workspace.look.theme_settings_description")}>
        <CustomCssQueryClientProvider>
          <ThemeStyling
            workspaceId={params.workspaceId}
            // A theme saved before the strict value schemas (ENG-2950) could otherwise fail its next save
            // on a value the form does not even show.
            workspace={{ ...workspace, styling: sanitizeThemeStyling(workspace.styling) }}
            colors={SURVEY_BG_COLORS}
            isUnsplashConfigured={!!UNSPLASH_ACCESS_KEY}
            isReadOnly={isReadOnly}
            isStorageConfigured={IS_STORAGE_CONFIGURED}
            publicDomain={publicDomain}
            customCssAccess={customCssAccess}
          />
        </CustomCssQueryClientProvider>
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
