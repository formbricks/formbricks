/**
 * Whether a survey's own Custom CSS applies (ENG-3723). It follows the survey's other style overrides:
 * the workspace must allow them ("Enable custom styling") and the survey must use them ("Add custom
 * styles"), the same rule that picks survey styling over the theme. Either off, and respondents and the
 * editor preview get the workspace CSS only; the survey's CSS stays saved and applies again once both
 * are back on.
 */
export const isSurveyCustomCssApplied = (params: {
  allowStyleOverwrite: boolean | null | undefined;
  overwriteThemeStyling: boolean | null | undefined;
}): boolean => Boolean(params.allowStyleOverwrite && params.overwriteThemeStyling);
