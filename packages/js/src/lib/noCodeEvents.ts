import type { Event } from "@formbricks/types/events";
import type { MatchType } from "@formbricks/types/js";
import { Config } from "./config";
import { InvalidMatchTypeError, Result, err, match, ok } from "./errors";
import { trackEvent } from "./event";
import { Logger } from "./logger";

const config = Config.getInstance();
const logger = Logger.getInstance();

export const checkPageUrl = (): void => {
  logger.debug("checking page url");
  const { settings } = config.get();
  const pageUrlEvents: Event[] = settings?.noCodeEvents.filter((e) => e.noCodeConfig?.type === "pageUrl");

  if (pageUrlEvents.length === 0) {
    return;
  }
  for (const event of pageUrlEvents) {
    const {
      noCodeConfig: { pageUrl },
    } = event;
    if (!pageUrl) {
      continue;
    }
    const match = checkUrlMatch(window.location.href, pageUrl.value, pageUrl.rule as MatchType);
    if (match) {
      trackEvent(event.name);
    }
  }
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
    case "contains":
      result = url.includes(pageUrlValue);
    case "startsWith":
      result = url.startsWith(pageUrlValue);
    case "endsWith":
      result = url.endsWith(pageUrlValue);
    case "notMatch":
      result = url !== pageUrlValue;
    case "notContains":
      result = !url.includes(pageUrlValue);
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
            config.errorHandler(err);
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
            config.errorHandler(err);
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
