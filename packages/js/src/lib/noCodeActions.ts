import type { TActionClass } from "@formbricks/types/v1/actionClasses";
import type { TActionClassPageUrlRule } from "@formbricks/types/v1/actionClasses";
import { Config } from "./config";
import { ErrorHandler, InvalidMatchTypeError, NetworkError, Result, err, match, ok, okVoid } from "./errors";
import { trackAction } from "./actions";
import { Logger } from "./logger";

const config = Config.getInstance();
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();

export const checkPageUrl = async (): Promise<Result<void, InvalidMatchTypeError | NetworkError>> => {
  logger.debug(`Checking page url: ${window.location.href}`);
  const { state } = config.get();
  if (state?.noCodeActionClasses === undefined) {
    return okVoid();
  }

  const pageUrlEvents: TActionClass[] = (state?.noCodeActionClasses || []).filter((action) => {
    const { innerHtml, cssSelector, pageUrl } = action.noCodeConfig || {};
    return pageUrl && !innerHtml && !cssSelector;
  });

  if (pageUrlEvents.length === 0) {
    return okVoid();
  }

  for (const event of pageUrlEvents) {
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

  return okVoid();
};

let arePageUrlEventListenersAdded = false;
const checkPageUrlWrapper = () => checkPageUrl();

export const addPageUrlEventListeners = (): void => {
  if (typeof window === "undefined" || arePageUrlEventListenersAdded) return;

  window.addEventListener("hashchange", checkPageUrlWrapper);
  window.addEventListener("popstate", checkPageUrlWrapper);
  window.addEventListener("pushstate", checkPageUrlWrapper);
  window.addEventListener("replacestate", checkPageUrlWrapper);
  window.addEventListener("load", checkPageUrlWrapper);

  arePageUrlEventListenersAdded = true;
};

export const removePageUrlEventListeners = (): void => {
  if (typeof window === "undefined" || !arePageUrlEventListenersAdded) return;

  window.removeEventListener("hashchange", checkPageUrlWrapper);
  window.removeEventListener("popstate", checkPageUrlWrapper);
  window.removeEventListener("pushstate", checkPageUrlWrapper);
  window.removeEventListener("replacestate", checkPageUrlWrapper);
  window.removeEventListener("load", checkPageUrlWrapper);

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

export const checkClickMatch = (event: MouseEvent) => {
  const { state } = config.get();
  if (!state) {
    return;
  }
  const targetElement = event.target as HTMLElement;
  (state?.noCodeActionClasses || []).forEach((action: TActionClass) => {
    const innerHtml = action.noCodeConfig?.innerHtml?.value;
    const cssSelectors = action.noCodeConfig?.cssSelector?.value;
    const pageUrl = action.noCodeConfig?.pageUrl?.value;
    const pageUrlRule = action.noCodeConfig?.pageUrl?.rule;

    if (!innerHtml && !cssSelectors && !pageUrl) {
      return;
    }

    if (innerHtml && targetElement.innerHTML !== innerHtml) {
      return;
    }

    if (cssSelectors) {
      // Split selectors that start with a . or # including the . or #
      const individualSelectors = cssSelectors.split(/\s*(?=[.#])/);
      for (let selector of individualSelectors) {
        if (!targetElement.matches(selector)) {
          return;
        }
      }
    }
    if (pageUrl && pageUrlRule) {
      const urlMatch = checkUrlMatch(window.location.href, pageUrl, pageUrlRule);
      if (!urlMatch.ok || !urlMatch.value) {
        return;
      }
    }

    trackAction(action.name).then((res) => {
      match(
        res,
        (_value) => {},
        (err) => {
          errorHandler.handle(err);
        }
      );
    });
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
