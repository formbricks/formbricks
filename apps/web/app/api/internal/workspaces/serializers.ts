import type { TWorkspace } from "@formbricks/types/workspace";
import type { TJsonTimestamps } from "@/modules/api/lib/json-timestamps";
import type { TEditorWorkspace } from "@/modules/survey/editor/lib/workspace";
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

/** A workspace as a switcher or a picker lists it, and as creating one answers it: its id and name. */
export type TWorkspaceOptionResource = { id: string; name: string };

export const serializeWorkspaceOption = (workspace: {
  id: string;
  name: string;
}): TWorkspaceOptionResource => ({
  id: workspace.id,
  name: workspace.name,
});

/**
 * A workspace as the survey editor reads it to refresh its state when the tab comes back into view: every
 * column but the custom CSS (ENG-2949), with ISO timestamps. Field for field the workspace the editor page
 * renders with, so a refresh that finds nothing changed leaves the editor as it is.
 */
export type TEditorWorkspaceResource = TJsonTimestamps<TEditorWorkspace>;

export const serializeEditorWorkspace = (workspace: TEditorWorkspace): TEditorWorkspaceResource => ({
  id: workspace.id,
  createdAt: workspace.createdAt.toISOString(),
  updatedAt: workspace.updatedAt.toISOString(),
  name: workspace.name,
  legacyEnvironmentId: workspace.legacyEnvironmentId,
  organizationId: workspace.organizationId,
  styling: workspace.styling,
  config: workspace.config,
  recontactDays: workspace.recontactDays,
  linkSurveyBranding: workspace.linkSurveyBranding,
  inAppSurveyBranding: workspace.inAppSurveyBranding,
  placement: workspace.placement,
  clickOutsideClose: workspace.clickOutsideClose,
  overlay: workspace.overlay,
  overlayColor: workspace.overlayColor,
  overlayOpacity: workspace.overlayOpacity,
  logo: workspace.logo,
  appSetupCompleted: workspace.appSetupCompleted,
  customHeadScripts: workspace.customHeadScripts,
});
