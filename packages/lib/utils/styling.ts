import { TJsEnvironmentStateProject, TJsEnvironmentStateSurvey } from "@formbricks/types/js";

export const getStyling = (project: TJsEnvironmentStateProject, survey: TJsEnvironmentStateSurvey) => {
  // allow style overwrite is disabled from the project
  if (!project.styling.allowStyleOverwrite) {
    return project.styling;
  }

  // allow style overwrite is enabled from the project
  if (project.styling.allowStyleOverwrite) {
    // survey style overwrite is disabled
    if (!survey.styling?.overwriteThemeStyling) {
      return project.styling;
    }

    // survey style overwrite is enabled
    return survey.styling;
  }

  return project.styling;
};
