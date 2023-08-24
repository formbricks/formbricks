import type { TActionClass } from "../../../types/v1/actionClasses";
import type { MatchType } from "../../../types/js";
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
    const {
      noCodeConfig: { pageUrl },
    } = event;
    if (!pageUrl) {
      continue;
    }
    const match = checkUrlMatch(window.location.href, pageUrl.value, pageUrl.rule as MatchType);

    if (match.ok !== true) return err(match.error);

    if (match.value === false) continue;

    const trackResult = await trackAction(event.name);

    if (trackResult.ok !== true) return err(trackResult.error);
  }

  return okVoid();
};

export const addPageUrlEventListeners = (): void => {
  if (typeof window === "undefined") return;

  window.addEventListener("hashchange", checkPageUrl);
  window.addEventListener("popstate", checkPageUrl);
  window.addEventListener("pushstate", checkPageUrl);
  window.addEventListener("replacestate", checkPageUrl);
  window.addEventListener("load", checkPageUrl);
};

export function checkUrlMatch(
  url: string,
  pageUrlValue: string,
  pageUrlRule: MatchType
): Result<boolean, InvalidMatchTypeError> {
  let result: boolean;
  let error: Result<never, InvalidMatchTypeError>;

  switch (pageUrlRule) {
    case "exactMatch":
      result = url === pageUrlValue;
      break;
    case "contains":
      result = url.includes(pageUrlValue);
      break;
    case "startsWith":
      result = url.startsWith(pageUrlValue);
      break;
    case "endsWith":
      result = url.endsWith(pageUrlValue);
      break;
    case "notMatch":
      result = url !== pageUrlValue;
      break;
    case "notContains":
      result = !url.includes(pageUrlValue);
      break;
    default:
      error = err({
        code: "invalid_match_type",
        message: "Invalid match type",
      });
  }

  if (error) {
    return error;
  }

  return ok(result);
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
    if (pageUrl) {
      const urlMatch = checkUrlMatch(window.location.href, pageUrl, action.noCodeConfig?.pageUrl?.rule);
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

export const addClickEventListener = (): void => {
  if (typeof window === "undefined") return;

  document.addEventListener("click", checkClickMatch);
};
