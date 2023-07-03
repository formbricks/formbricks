import type { Event } from "../../../types/events";
import type { MatchType } from "../../../types/js";
import { Config } from "./config";
import { ErrorHandler, InvalidMatchTypeError, NetworkError, Result, err, match, ok, okVoid } from "./errors";
import { trackEvent } from "./event";
import { Logger } from "./logger";

const config = Config.getInstance();
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();

export const checkPageUrl = async (): Promise<Result<void, InvalidMatchTypeError | NetworkError>> => {
  logger.debug(`Checking page url: ${window.location.href}`);
  const { settings } = config.get();
  if (settings?.noCodeEvents === undefined) {
    return okVoid();
  }

  const pageUrlEvents: Event[] = settings?.noCodeEvents.filter((e) => e.noCodeConfig?.type === "pageUrl");

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

    const trackResult = await trackEvent(event.name);

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
  const { settings } = config.get();
  const innerHtmlEvents: Event[] = settings?.noCodeEvents.filter((e) => e.noCodeConfig?.type === "innerHtml");
  const cssSelectorEvents: Event[] = settings?.noCodeEvents.filter(
    (e) => e.noCodeConfig?.type === "cssSelector"
  );

  const targetElement = event.target as HTMLElement;

  innerHtmlEvents.forEach((e) => {
    const innerHtml = e.noCodeConfig?.innerHtml;
    if (innerHtml && targetElement.innerHTML === innerHtml.value) {
      trackEvent(e.name).then((res) => {
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

  cssSelectorEvents.forEach((e) => {
    const cssSelector = e.noCodeConfig?.cssSelector;
    if (cssSelector && targetElement.matches(cssSelector.value)) {
      trackEvent(e.name).then((res) => {
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
};

export const addClickEventListener = (): void => {
  if (typeof window === "undefined") return;

  document.addEventListener("click", checkClickMatch);
};
