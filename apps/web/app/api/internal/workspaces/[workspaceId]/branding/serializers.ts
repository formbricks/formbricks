/** A workspace's branding settings, as the Look & Feel page edits them. */
export type TWorkspaceBrandingResource = {
  workspaceId: string;
  linkSurveyBranding: boolean;
  inAppSurveyBranding: boolean;
};

export const serializeWorkspaceBranding = (workspace: {
  id: string;
  linkSurveyBranding: boolean;
  inAppSurveyBranding: boolean;
}): TWorkspaceBrandingResource => ({
  workspaceId: workspace.id,
  linkSurveyBranding: workspace.linkSurveyBranding,
  inAppSurveyBranding: workspace.inAppSurveyBranding,
});
