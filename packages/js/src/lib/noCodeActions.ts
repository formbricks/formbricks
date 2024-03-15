import type { TActionClass } from "@formbricks/types/actionClasses";
import type { TActionClassPageUrlRule } from "@formbricks/types/actionClasses";
import { TSurveyInlineTriggers } from "@formbricks/types/surveys";

import { trackAction } from "./actions";
import { Config } from "./config";
import { ErrorHandler, InvalidMatchTypeError, NetworkError, Result, err, match, ok, okVoid } from "./errors";
import { Logger } from "./logger";
import { renderWidget } from "./widget";

const config = Config.getInstance();
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();

export const checkPageUrl = async (): Promise<Result<void, InvalidMatchTypeError | NetworkError>> => {
  logger.debug(`Checking page url: ${window.location.href}`);
  const { state } = config.get();
  const { noCodeActionClasses = [], surveys = [] } = state ?? {};

  const actionsWithPageUrl: TActionClass[] = noCodeActionClasses.filter((action) => {
    const { innerHtml, cssSelector, pageUrl } = action.noCodeConfig || {};
    return pageUrl && !innerHtml && !cssSelector;
  });

  const surveysWithInlineTriggers = surveys.filter((survey) => {
    const { pageUrl, cssSelector, innerHtml } = survey.inlineTriggers?.noCodeConfig || {};
    return pageUrl && !cssSelector && !innerHtml;
  });

  if (actionsWithPageUrl.length > 0) {
    for (const event of actionsWithPageUrl) {
      if (!event.noCodeConfig?.pageUrl) {
        continue;
      }

      const {
        noCodeConfig: { pageUrl },
      } = event;

      const match = checkUrlMatch(window.location.href, pageUrl.value, pageUrl.rule);

      if (match.ok !== true) return err(match.error);

      if (match.value === false) continue;

      const trackResult = await trackAction(event.name);

      if (trackResult.ok !== true) return err(trackResult.error);
    }
  }

  if (surveysWithInlineTriggers.length > 0) {
    surveysWithInlineTriggers.forEach((survey) => {
      const { noCodeConfig } = survey.inlineTriggers ?? {};
      const { pageUrl } = noCodeConfig ?? {};

      if (pageUrl) {
        const match = checkUrlMatch(window.location.href, pageUrl.value, pageUrl.rule);

        if (match.ok !== true) return err(match.error);
        if (match.value === false) return;

        renderWidget(survey);
      }
    });
  }

  return okVoid();
};

let arePageUrlEventListenersAdded = false;
const checkPageUrlWrapper = () => checkPageUrl();
const events = ["hashchange", "popstate", "pushstate", "replacestate", "load"];

export const addPageUrlEventListeners = (): void => {
  if (typeof window === "undefined" || arePageUrlEventListenersAdded) return;
  events.forEach((event) => window.addEventListener(event, checkPageUrlWrapper));
  arePageUrlEventListenersAdded = true;
};

export const removePageUrlEventListeners = (): void => {
  if (typeof window === "undefined" || !arePageUrlEventListenersAdded) return;
  events.forEach((event) => window.removeEventListener(event, checkPageUrlWrapper));
  arePageUrlEventListenersAdded = false;
};

export function checkUrlMatch(
  url: string,
  pageUrlValue: string,
  pageUrlRule: TActionClassPageUrlRule
): Result<boolean, InvalidMatchTypeError> {
  switch (pageUrlRule) {
    case "exactMatch":
      return ok(url === pageUrlValue);
    case "contains":
      return ok(url.includes(pageUrlValue));
    case "startsWith":
      return ok(url.startsWith(pageUrlValue));
    case "endsWith":
      return ok(url.endsWith(pageUrlValue));
    case "notMatch":
      return ok(url !== pageUrlValue);
    case "notContains":
      return ok(!url.includes(pageUrlValue));
    default:
      return err({
        code: "invalid_match_type",
        message: "Invalid match type",
      });
  }
}

const evaluateNoCodeConfig = (
  targetElement: HTMLElement,
  action: TActionClass | TSurveyInlineTriggers
): boolean => {
  const innerHtml = action.noCodeConfig?.innerHtml?.value;
  const cssSelectors = action.noCodeConfig?.cssSelector?.value;
  const pageUrl = action.noCodeConfig?.pageUrl?.value;
  const pageUrlRule = action.noCodeConfig?.pageUrl?.rule;

  if (!innerHtml && !cssSelectors && !pageUrl) {
    return false;
  }

  if (innerHtml && targetElement.innerHTML !== innerHtml) {
    return false;
  }

  if (cssSelectors) {
    // Split selectors that start with a . or # including the . or #
    const individualSelectors = cssSelectors.split(/\s*(?=[.#])/);
    for (let selector of individualSelectors) {
      if (!targetElement.matches(selector)) {
        return false;
      }
    }
  }

  if (pageUrl && pageUrlRule) {
    const urlMatch = checkUrlMatch(window.location.href, pageUrl, pageUrlRule);
    if (!urlMatch.ok || !urlMatch.value) {
      return false;
    }
  }

  return true;
};

export const checkClickMatch = (event: MouseEvent) => {
  const { state } = config.get();
  if (!state) {
    return;
  }

  const { noCodeActionClasses } = state;
  if (!noCodeActionClasses) {
    return;
  }

  const targetElement = event.target as HTMLElement;

  noCodeActionClasses.forEach((action: TActionClass) => {
    const shouldTrack = evaluateNoCodeConfig(targetElement, action);
    if (shouldTrack) {
      trackAction(action.name).then((res) => {
        match(
          res,
          (_value) => {},
          (err) => {
            errorHandler.handle(err);
          }
        );
      });
    }
  });

  // check for the inline triggers as well
  const activeSurveys = state.surveys;
  if (!activeSurveys || activeSurveys.length === 0) {
    return;
  }

  activeSurveys.forEach((survey) => {
    const { inlineTriggers } = survey;
    if (inlineTriggers) {
      const shouldTrack = evaluateNoCodeConfig(targetElement, inlineTriggers);
      if (shouldTrack) {
        renderWidget(survey);
      }
    }
  });
};

let isClickEventListenerAdded = false;
const checkClickMatchWrapper = (e: MouseEvent) => checkClickMatch(e);

export const addClickEventListener = (): void => {
  if (typeof window === "undefined" || isClickEventListenerAdded) return;

  document.addEventListener("click", checkClickMatchWrapper);

  isClickEventListenerAdded = true;
};

export const removeClickEventListener = (): void => {
  if (!isClickEventListenerAdded) return;

  document.removeEventListener("click", checkClickMatchWrapper);

  isClickEventListenerAdded = false;
};
