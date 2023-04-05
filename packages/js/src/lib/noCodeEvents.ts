import type { MatchType } from "@formbricks/types/js";
import { Config } from "./config";
import { trackEvent } from "./event";
import { Logger } from "./logger";

const config = Config.getInstance();
const logger = Logger.getInstance();

const { settings } = config.get();
const innerHtmlEvents = settings?.noCodeEvents.filter((e) => e.noCodeConfig?.type === "innerHtml");
const cssSelectorEvents = settings?.noCodeEvents.filter((e) => e.noCodeConfig?.type === "cssSelector");
const pageUrlEvents = settings?.noCodeEvents.filter((e) => e.noCodeConfig?.type === "pageUrl");

export const checkPageUrl = (): void => {
  logger.debug("checking page url");

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
    const match = checkUrlMatch(window.location.href, pageUrl.value, pageUrl.rule);
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

export function checkUrlMatch(url: string, pageUrlValue: string, pageUrlRule: MatchType): boolean {
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
    default:
      throw new Error("Invalid match type");
  }
}

export const checkClickMatch = (event: MouseEvent) => {
  const targetElement = event.target as HTMLElement;

  innerHtmlEvents.forEach((e) => {
    const innerHtml = e.noCodeConfig?.innerHtml;
    if (innerHtml && targetElement.innerHTML === innerHtml.value) {
      trackEvent(e.name);
    }
  });

  cssSelectorEvents.forEach((e) => {
    const cssSelector = e.noCodeConfig?.cssSelector;
    if (cssSelector && targetElement.matches(cssSelector.value)) {
      trackEvent(e.name);
    }
  });
};

export const addClickEventListener = (): void => {
  if (typeof window === "undefined") return;

  document.addEventListener("click", checkClickMatch);
};
