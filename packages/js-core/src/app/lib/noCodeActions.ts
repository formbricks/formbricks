import type { TActionClass } from "@formbricks/types/action-classes";
import { ErrorHandler, NetworkError, Result, err, match, okVoid } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { evaluateNoCodeConfigClick, handleUrlFilters } from "../../shared/utils";
import { trackNoCodeAction } from "./actions";
import { AppConfig } from "./config";

const inAppConfig = AppConfig.getInstance();
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();

// Event types for various listeners
const events = ["hashchange", "popstate", "pushstate", "replacestate", "load"];

// Page URL Event Handlers
let arePageUrlEventListenersAdded = false;

export const checkPageUrl = async (): Promise<Result<void, NetworkError>> => {
  logger.debug(`Checking page url: ${window.location.href}`);
  const { state } = inAppConfig.get();
  const { actionClasses = [] } = state ?? {};

  const noCodePageViewActionClasses = actionClasses.filter(
    (action) => action.type === "noCode" && action.noCodeConfig?.type === "pageView"
  );

  for (const event of noCodePageViewActionClasses) {
    const urlFilters = event.noCodeConfig?.urlFilters ?? [];
    const isValidUrl = handleUrlFilters(urlFilters);

    if (!isValidUrl) continue;

    const trackResult = await trackNoCodeAction(event.name);
    if (trackResult.ok !== true) return err(trackResult.error);
  }

  return okVoid();
};

const checkPageUrlWrapper = () => checkPageUrl();

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

// Click Event Handlers
let isClickEventListenerAdded = false;

const checkClickMatch = (event: MouseEvent) => {
  const { state } = inAppConfig.get();
  if (!state) return;

  const { actionClasses = [] } = state;
  const noCodeClickActionClasses = actionClasses.filter(
    (action) => action.type === "noCode" && action.noCodeConfig?.type === "click"
  );

  const targetElement = event.target as HTMLElement;

  noCodeClickActionClasses.forEach((action: TActionClass) => {
    if (evaluateNoCodeConfigClick(targetElement, action)) {
      trackNoCodeAction(action.name).then((res) => {
        match(
          res,
          (_value: unknown) => {},
          (err: any) => errorHandler.handle(err)
        );
      });
    }
  });
};

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

// Exit Intent Handlers
let isExitIntentListenerAdded = false;

const checkExitIntent = async (e: MouseEvent) => {
  const { state } = inAppConfig.get();
  const { actionClasses = [] } = state ?? {};

  const noCodeExitIntentActionClasses = actionClasses.filter(
    (action) => action.type === "noCode" && action.noCodeConfig?.type === "exitIntent"
  );

  if (e.clientY <= 0 && noCodeExitIntentActionClasses.length > 0) {
    for (const event of noCodeExitIntentActionClasses) {
      const urlFilters = event.noCodeConfig?.urlFilters ?? [];
      const isValidUrl = handleUrlFilters(urlFilters);

      if (!isValidUrl) continue;

      const trackResult = await trackNoCodeAction(event.name);
      if (trackResult.ok !== true) return err(trackResult.error);
    }
  }
};

const checkExitIntentWrapper = (e: MouseEvent) => checkExitIntent(e);

export const addExitIntentListener = (): void => {
  if (typeof document !== "undefined" && !isExitIntentListenerAdded) {
    document.querySelector("body")!.addEventListener("mouseleave", checkExitIntentWrapper);
    isExitIntentListenerAdded = true;
  }
};

export const removeExitIntentListener = (): void => {
  if (isExitIntentListenerAdded) {
    document.removeEventListener("mouseleave", checkExitIntentWrapper);
    isExitIntentListenerAdded = false;
  }
};

// Scroll Depth Handlers
let scrollDepthListenerAdded = false;
let scrollDepthTriggered = false;

const checkScrollDepth = async () => {
  const scrollPosition = window.scrollY;
  const windowSize = window.innerHeight;
  const bodyHeight = document.documentElement.scrollHeight;

  if (scrollPosition === 0) {
    scrollDepthTriggered = false;
  }

  if (!scrollDepthTriggered && scrollPosition / (bodyHeight - windowSize) >= 0.5) {
    scrollDepthTriggered = true;

    const { state } = inAppConfig.get();
    const { actionClasses = [] } = state ?? {};

    const noCodefiftyPercentScrollActionClasses = actionClasses.filter(
      (action) => action.type === "noCode" && action.noCodeConfig?.type === "fiftyPercentScroll"
    );

    for (const event of noCodefiftyPercentScrollActionClasses) {
      const urlFilters = event.noCodeConfig?.urlFilters ?? [];
      const isValidUrl = handleUrlFilters(urlFilters);

      if (!isValidUrl) continue;

      const trackResult = await trackNoCodeAction(event.name);
      if (trackResult.ok !== true) return err(trackResult.error);
    }
  }

  return okVoid();
};

const checkScrollDepthWrapper = () => checkScrollDepth();

export const addScrollDepthListener = (): void => {
  if (typeof window !== "undefined" && !scrollDepthListenerAdded) {
    window.addEventListener("load", () => {
      window.addEventListener("scroll", checkScrollDepthWrapper);
    });
    scrollDepthListenerAdded = true;
  }
};

export const removeScrollDepthListener = (): void => {
  if (scrollDepthListenerAdded) {
    window.removeEventListener("scroll", checkScrollDepthWrapper);
    scrollDepthListenerAdded = false;
  }
};
