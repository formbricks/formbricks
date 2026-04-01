import { TJsEnvironmentStateSurvey, TJsEnvironmentStateWorkspace } from "@formbricks/types/js";

export const getStyling = (workspace: TJsEnvironmentStateWorkspace, survey: TJsEnvironmentStateSurvey) => {
  // allow style overwrite is disabled from the workspace
  if (!workspace.styling.allowStyleOverwrite) {
    return workspace.styling;
  }

  // allow style overwrite is enabled from the workspace
  if (workspace.styling.allowStyleOverwrite) {
    // survey style overwrite is disabled
    if (!survey.styling?.overwriteThemeStyling) {
      return workspace.styling;
    }

    // survey style overwrite is enabled
    return survey.styling;
  }

  return workspace.styling;
};
