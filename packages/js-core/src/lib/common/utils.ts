import { DEBUG_SESSION_STORAGE_KEY } from "@/lib/common/constants";
import type {
  TRendererCustomCss,
  TSurveyStyling,
  TUserState,
  TWorkspaceState,
  TWorkspaceStateActionClass,
  TWorkspaceStateSettings,
  TWorkspaceStateSurvey,
  TWorkspaceStyling,
} from "@/types/config";
import type { TDebugSurveyExclusion } from "@/types/debug";
import type { Result } from "@/types/error";
import { type TActionClassNoCodeConfig, type TActionClassPageUrlRule } from "@/types/survey";

// Helper function to calculate difference in days between two dates
export const diffInDays = (date1: Date, date2: Date): number => {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

export const wrapThrows =
  <T, A extends unknown[]>(fn: (...args: A) => T): ((...args: A) => Result<T>) =>
  (...args: A): Result<T> => {
    try {
      return {
        ok: true,
        data: fn(...args),
      };
    } catch (error) {
      return {
        ok: false,
        error: error as Error,
      };
    }
  };

export const wrapThrowsAsync =
  <T, A extends unknown[]>(fn: (...args: A) => Promise<T>) =>
  async (...args: A): Promise<Result<T>> => {
    try {
      return {
        ok: true,
        data: await fn(...args),
      };
    } catch (error) {
      return {
        ok: false,
        error: error as Error,
      };
    }
  };

/**
 * Detect whether a survey's segment has filters. Handles both the current
 * minimal shape (`{ id, hasFilters }`) and the legacy shape with a `filters`
 * array — older SDKs cached the full segment in localStorage and may still be
 * read back here within the cache window after an SDK upgrade.
 */
export const surveyHasSegmentFilters = (survey: TWorkspaceStateSurvey): boolean => {
  const segment = survey.segment as { hasFilters?: boolean; filters?: unknown[] } | null | undefined;
  if (!segment) return false;
  if (typeof segment.hasFilters === "boolean") return segment.hasFilters;
  return Array.isArray(segment.filters) && segment.filters.length > 0;
};

/** Why a survey is dropped before any trigger fires. The debug panel shows it to explain a no-show. */
type TSurveyExclusionReason = TDebugSurveyExclusion;

const getDisplayOptionExclusion = (
  survey: TWorkspaceStateSurvey,
  userState: TUserState
): TSurveyExclusionReason | null => {
  const { displays, responses } = userState.data;
  const displayCount = displays.filter((display) => display.surveyId === survey.id).length;
  const hasResponded = responses.includes(survey.id);

  switch (survey.displayOption) {
    case "respondMultiple":
      return null;
    case "displayOnce":
      return displayCount === 0 ? null : "alreadyDisplayed";
    case "displayMultiple":
      return hasResponded ? "alreadyResponded" : null;
    case "displaySome":
      if (survey.displayLimit === null) return null;
      if (hasResponded) return "alreadyResponded";
      return displayCount < survey.displayLimit ? null : "displayLimitReached";
    default:
      throw Error("Invalid displayOption");
  }
};

// The cooldown counts from the visitor's last display of ANY survey. `surveyId` stays on each stored
// display anyway: a per-survey recontact window (ENG-3571, paused) would need it, so don't remove it.
const isInCooldown = (
  survey: TWorkspaceStateSurvey,
  workspace: TWorkspaceState,
  userState: TUserState
): boolean => {
  const { lastDisplayAt } = userState.data;
  if (!lastDisplayAt) return false;

  // The survey's own value wins, even 0; the workspace value applies only when set and non-zero.
  const cooldownDays = survey.recontactDays ?? (workspace.data.settings.recontactDays || null);
  if (cooldownDays === null) return false;

  return diffInDays(new Date(), new Date(lastDisplayAt)) < cooldownDays;
};

const isOutsideSegment = (survey: TWorkspaceStateSurvey, userState: TUserState): boolean => {
  const { segments, userId } = userState.data;
  // Anonymous visitors only see surveys whose segment has no filters.
  if (!userId) return surveyHasSegmentFilters(survey);
  return !(survey.segment?.id && segments.includes(survey.segment.id));
};

export const getSurveyExclusionReason = (
  survey: TWorkspaceStateSurvey,
  workspace: TWorkspaceState,
  userState: TUserState
): TSurveyExclusionReason | null => {
  const displayOptionExclusion = getDisplayOptionExclusion(survey, userState);
  if (displayOptionExclusion) return displayOptionExclusion;
  if (isInCooldown(survey, workspace, userState)) return "cooldown";
  if (isOutsideSegment(survey, userState)) return "segment";
  return null;
};

/** The surveys this visitor can be shown at all: display option, cooldown and segment. */
export const filterSurveys = (workspace: TWorkspaceState, userState: TUserState): TWorkspaceStateSurvey[] =>
  workspace.data.surveys.filter((survey) => getSurveyExclusionReason(survey, workspace, userState) === null);

export const getStyling = (
  settings: TWorkspaceStateSettings,
  survey: TWorkspaceStateSurvey
): TWorkspaceStyling | TSurveyStyling => {
  // allow style overwrite is enabled from the workspace
  if (settings.styling.allowStyleOverwrite) {
    // survey style overwrite is disabled
    if (!survey.styling?.overwriteThemeStyling) {
      return settings.styling;
    }

    // survey style overwrite is enabled
    return survey.styling;
  }

  // allow style overwrite is disabled from the workspace
  return settings.styling;
};

/**
 * The renderer's explicit `customCss` prop (ENG-3552): the workspace CSS, sent once in the workspace
 * settings, plus this survey's own. Unlike `getStyling`, nothing here picks one object over the other:
 * the server already leaves out a survey's CSS while its style overrides are off. A state cached before
 * the server sent CSS simply has neither field, and the renderer then applies none.
 */
export const getCustomCss = (
  settings: TWorkspaceStateSettings,
  survey: TWorkspaceStateSurvey
): TRendererCustomCss => ({
  workspace: settings.customCss,
  survey: survey.customCss,
});

export const getDefaultLanguageCode = (survey: TWorkspaceStateSurvey): string | undefined => {
  const defaultSurveyLanguage = survey.languages.find((surveyLanguage) => {
    return surveyLanguage.default;
  });
  if (defaultSurveyLanguage) return defaultSurveyLanguage.language.code;
};

/**
 * The browser's preferred languages, most preferred first, for "Use browser language by default".
 * `navigator.languages` is the full preference list; `navigator.language` is the fallback for
 * environments that only expose the single preferred language. Empty when neither is available
 * (server rendering, web workers without a navigator, or locked-down embeds).
 */
export const getBrowserLanguageCodes = (): string[] => {
  if (typeof navigator === "undefined") return [];

  const { languages, language } = navigator as Partial<Navigator>;
  if (Array.isArray(languages)) {
    const preferredLanguages = languages.filter(
      (code): code is string => typeof code === "string" && code.trim() !== ""
    );
    if (preferredLanguages.length > 0) return preferredLanguages;
  }

  return typeof language === "string" && language.trim() !== "" ? [language] : [];
};

export const getSecureRandom = (): number => {
  const u32 = new Uint32Array(1);
  crypto.getRandomValues(u32);
  return u32[0] / 2 ** 32; // Normalized to [0, 1)
};

export const shouldDisplayBasedOnPercentage = (displayPercentage: number): boolean => {
  const randomNum = Math.floor(getSecureRandom() * 10000) / 100;
  return randomNum <= displayPercentage;
};

export const isNowExpired = (expirationDate: Date): boolean => new Date() >= expirationDate;

export const checkUrlMatch = (
  url: string,
  pageUrlValue: string,
  pageUrlRule: TActionClassPageUrlRule
): boolean => {
  let regex: RegExp;

  switch (pageUrlRule) {
    case "exactMatch":
      return url === pageUrlValue;
    case "contains":
      return url.includes(pageUrlValue);
    case "startsWith":
      return url.startsWith(pageUrlValue);
    case "endsWith":
      return url.endsWith(pageUrlValue);
    case "notMatch":
      return url !== pageUrlValue;
    case "notContains":
      return !url.includes(pageUrlValue);
    case "matchesRegex":
      try {
        regex = new RegExp(pageUrlValue);
      } catch {
        // edge case: fail closed if the regex expression is invalid
        return false;
      }

      return regex.test(url);
    default:
      return false;
  }
};

export const handleUrlFilters = (
  urlFilters: TActionClassNoCodeConfig["urlFilters"],
  connector: "or" | "and" = "or"
): boolean => {
  if (urlFilters.length === 0) {
    return true;
  }

  const windowUrl = window.location.href;

  if (connector === "and") {
    const isMatch = urlFilters.every((filter) => {
      const match = checkUrlMatch(windowUrl, filter.value, filter.rule);
      return match;
    });
    return isMatch;
  }

  const isMatch = urlFilters.some((filter) => {
    const match = checkUrlMatch(windowUrl, filter.value, filter.rule);
    return match;
  });

  return isMatch;
};

export const evaluateNoCodeConfigClick = (
  targetElement: HTMLElement,
  action: TWorkspaceStateActionClass
): boolean => {
  if (action.noCodeConfig?.type !== "click") return false;

  const innerHtml = action.noCodeConfig.elementSelector.innerHtml;
  const cssSelector = action.noCodeConfig.elementSelector.cssSelector;
  const urlFilters = action.noCodeConfig.urlFilters;

  if (!innerHtml && !cssSelector) return false;

  // Resolve the element to test: prefer the direct click target, but walk up to
  // the nearest ancestor that matches the CSS selector (event delegation for nested markup,
  // e.g. <svg> or <span> inside a <button class="my-btn">).
  let matchedElement: HTMLElement = targetElement;

  if (cssSelector) {
    let matchesDirectly = false;
    try {
      matchesDirectly = targetElement.matches(cssSelector);
    } catch {
      matchesDirectly = false;
    }
    if (!matchesDirectly) {
      const ancestor = targetElement.closest(cssSelector);
      if (!ancestor) return false;
      matchedElement = ancestor as HTMLElement;
    }
  }

  // Check innerHtml against the resolved element, not the raw click target
  if (innerHtml && matchedElement.innerHTML !== innerHtml) return false;

  const connector = action.noCodeConfig.urlFiltersConnector ?? "or";
  const isValidUrl = handleUrlFilters(urlFilters, connector);

  if (!isValidUrl) return false;

  return true;
};

/**
 * Debug mode starts with `?formbricksDebug=true` and stays on for the rest of the tab, so a multi-page
 * site keeps it on the next page load without the parameter on every link. `?formbricksDebug=false`
 * turns it off. Kept in sessionStorage, like the visit; with storage blocked, only the URL counts.
 */
export const getIsDebug = (): boolean => {
  const { search } = window.location;
  try {
    if (search.includes("formbricksDebug=true")) {
      sessionStorage.setItem(DEBUG_SESSION_STORAGE_KEY, "true");
      return true;
    }
    if (search.includes("formbricksDebug=false")) {
      sessionStorage.removeItem(DEBUG_SESSION_STORAGE_KEY);
      return false;
    }
    return sessionStorage.getItem(DEBUG_SESSION_STORAGE_KEY) === "true";
  } catch {
    return search.includes("formbricksDebug=true");
  }
};
