import type { TSurveyAppearance } from "@formbricks/types/appearance";
import type { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { addCustomThemeToDom } from "./styles";

type AppearancePreference = TSurveyAppearance | "system";
let activeStyling: SurveyContainerProps["styling"] | undefined;
let currentAppearance: TSurveyAppearance = "light";
let systemQuery: MediaQueryList | undefined;
let unsubscribe: (() => void) | undefined;

export const getAppearance = (): TSurveyAppearance => currentAppearance;

export const disposeAppearance = () => {
  unsubscribe?.();
  unsubscribe = undefined;
  activeStyling = undefined;
};

const applyAppearance = (appearance: TSurveyAppearance) => {
  currentAppearance = appearance;
  if (activeStyling) addCustomThemeToDom({ styling: activeStyling, appearance });
  document.querySelectorAll("#fbjs").forEach((root) => root.setAttribute("data-appearance", appearance));
};

/** Updates tokens and selectors in place; does not remount the survey or replace respondent answers. */
export const setAppearance = (appearance: AppearancePreference): void => {
  unsubscribe?.();
  unsubscribe = undefined;
  if (appearance === "system" && typeof globalThis.matchMedia === "function") {
    systemQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance(systemQuery!.matches ? "dark" : "light");
    systemQuery.addEventListener("change", onChange);
    const query = systemQuery;
    unsubscribe = () => query.removeEventListener("change", onChange);
    onChange();
  } else {
    applyAppearance(appearance === "dark" ? "dark" : "light");
  }
};

export const initializeAppearance = (
  styling: SurveyContainerProps["styling"],
  appearance: AppearancePreference = "light"
) => {
  activeStyling = styling;
  setAppearance(appearance);
};
