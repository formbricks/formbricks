import { STYLING_COLOR_KEYS, TSurveyAppearance } from "@formbricks/types/appearance";
import { TBaseStyling } from "@formbricks/types/styling";

/** Reset only the selected appearance. Shared dimensions belong to the light/default reset. */
export const resetStylingAppearance = <T extends TBaseStyling>(
  current: T,
  defaults: TBaseStyling,
  appearance: TSurveyAppearance
): T => {
  const next = appearance === "dark" ? { ...current } : { ...current, ...defaults };
  for (const key of STYLING_COLOR_KEYS) {
    const light =
      (appearance === "light" ? defaults[key]?.light : current[key]?.light) ?? current[key]?.light;
    next[key] = light ? { light, dark: appearance === "dark" ? null : current[key]?.dark } : null;
  }
  return next;
};
