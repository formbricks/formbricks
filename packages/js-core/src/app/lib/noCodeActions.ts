import type { TActionClass } from "@formbricks/types/actionClasses";
import type { TActionClassPageUrlRule } from "@formbricks/types/actionClasses";

import {
  ErrorHandler,
  InvalidMatchTypeError,
  NetworkError,
  Result,
  err,
  match,
  ok,
  okVoid,
} from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { trackNoCodeAction } from "./actions";
import { AppConfig } from "./config";

const inAppConfig = AppConfig.getInstance();
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();

export const checkPageUrl = async (): Promise<Result<void, InvalidMatchTypeError | NetworkError>> => {
  logger.debug(`Checking page url: ${window.location.href}`);
  const { state } = inAppConfig.get();
  const { actionClasses = [] } = state ?? {};

  const noCodeActionClasses = actionClasses.filter((action) => action.type === "noCode");

  const actionsWithPageUrl: TActionClass[] = noCodeActionClasses.filter((action) => {
    const { innerHtml, cssSelector, pageUrl } = action.noCodeConfig || {};
    return pageUrl && !innerHtml && !cssSelector;
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

      const trackResult = await trackNoCodeAction(event.name);

      if (trackResult.ok !== true) return err(trackResult.error);
    }
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

export const checkUrlMatch = (
  url: string,
  pageUrlValue: string,
  pageUrlRule: TActionClassPageUrlRule
): Result<boolean, InvalidMatchTypeError> => {
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
};

const evaluateNoCodeConfig = (targetElement: HTMLElement, action: TActionClass): boolean => {
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
  const { state } = inAppConfig.get();
  if (!state) {
    return;
  }

  const { actionClasses = [] } = state;
  const noCodeActionClasses = actionClasses.filter((action) => action.type === "noCode");

  if (!noCodeActionClasses.length) {
    return;
  }

  const targetElement = event.target as HTMLElement;

  noCodeActionClasses.forEach((action: TActionClass) => {
    const isMatch = evaluateNoCodeConfig(targetElement, action);
    if (isMatch) {
      trackNoCodeAction(action.name).then((res) => {
        match(
          res,
          (_value: unknown) => {},
          (err: any) => {
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
