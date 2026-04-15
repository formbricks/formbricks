import { TJsEnvironmentStateProject, TJsEnvironmentStateSurvey } from "@formbricks/types/js";

export const getStyling = (project: TJsEnvironmentStateProject, survey: TJsEnvironmentStateSurvey) => {
  const resolvedIsPageFontInherited =
    survey.styling?.isPageFontInherited ?? project.styling.isPageFontInheritedByDefault ?? false;
  const getFontOverrides = () => ({
    isPageFontInherited: resolvedIsPageFontInherited,
    ...(survey.styling?.fontFamily !== undefined ? { fontFamily: survey.styling.fontFamily } : {}),
  });

  // allow style overwrite is disabled from the project
  if (!project.styling.allowStyleOverwrite) {
    return {
      ...project.styling,
      ...getFontOverrides(),
    };
  }

  // allow style overwrite is enabled from the project
  if (project.styling.allowStyleOverwrite) {
    // survey style overwrite is disabled
    if (!survey.styling?.overwriteThemeStyling) {
      return {
        ...project.styling,
        ...getFontOverrides(),
      };
    }

    // survey style overwrite is enabled
    return {
      ...survey.styling,
      isPageFontInherited: resolvedIsPageFontInherited,
    };
  }

  return project.styling;
};
