import type { TWorkspace } from "@formbricks/types/workspace";
import type { TPostWorkspaceDeletionDestination } from "@/modules/workspaces/settings/general/lib/post-workspace-deletion-redirect";

/**
 * The workspace settings the settings pages edit, as a PATCH answers them. The tenant anchor, languages and
 * setup state stay out; `updatedAt` is in because a logo write needs it as its next baseline.
 */
export type TWorkspaceSettingsResource = Pick<
  TWorkspace,
  | "id"
  | "name"
  | "recontactDays"
  | "inAppSurveyBranding"
  | "linkSurveyBranding"
  | "config"
  | "placement"
  | "clickOutsideClose"
  | "overlay"
  | "styling"
> & {
  updatedAt: string;
  overlayColor: TWorkspace["overlayColor"] | null;
  overlayOpacity: TWorkspace["overlayOpacity"] | null;
  logo: TWorkspace["logo"] | null;
  customHeadScripts: string | null;
};

export const serializeWorkspaceSettings = (workspace: TWorkspace): TWorkspaceSettingsResource => ({
  id: workspace.id,
  updatedAt: workspace.updatedAt.toISOString(),
  name: workspace.name,
  recontactDays: workspace.recontactDays,
  inAppSurveyBranding: workspace.inAppSurveyBranding,
  linkSurveyBranding: workspace.linkSurveyBranding,
  config: workspace.config,
  placement: workspace.placement,
  clickOutsideClose: workspace.clickOutsideClose,
  overlay: workspace.overlay,
  overlayColor: workspace.overlayColor ?? null,
  overlayOpacity: workspace.overlayOpacity ?? null,
  styling: workspace.styling,
  logo: workspace.logo ?? null,
  customHeadScripts: workspace.customHeadScripts ?? null,
});

/** What deleting a workspace answers: where the dashboard goes next, resolved after the deletion. */
export type TWorkspaceDeletionResource = { destination: TPostWorkspaceDeletionDestination };
