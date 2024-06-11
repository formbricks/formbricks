import type { TActionClass } from "@formbricks/types/actionClasses";
import { TJsPackageType } from "@formbricks/types/js";
import { trackNoCodeAction as trackNoCodeAppAction } from "../app/lib/actions";
import { AppConfig } from "../app/lib/config";
import { trackNoCodeAction as trackNoCodeWebsiteAction } from "../website/lib/actions";
import { WebsiteConfig } from "../website/lib/config";
import { ErrorHandler, NetworkError, Result, err, match, okVoid } from "./errors";
import { Logger } from "./logger";
import { evaluateNoCodeConfigClick, handleUrlFilters } from "./utils";

const inAppConfig = AppConfig.getInstance();
const websiteConfig = WebsiteConfig.getInstance();

const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();

const getConfig = (packageType: TJsPackageType): WebsiteConfig | AppConfig => {
  switch (packageType) {
    case "website":
      return websiteConfig;
    case "app":
      return inAppConfig;
  }
};

const getNoCodeActionTracker = (packageType: TJsPackageType) => {
  switch (packageType) {
    case "website":
      return trackNoCodeWebsiteAction;
    case "app":
      return trackNoCodeAppAction;
  }
};

// Event types for various listeners
const events = ["hashchange", "popstate", "pushstate", "replacestate", "load"];

// Page URL Event Handlers
let arePageUrlEventListenersAdded = false;

export const checkPageUrl = async (packageType: TJsPackageType): Promise<Result<void, NetworkError>> => {
  logger.debug(`Checking page url: ${window.location.href}`);

  const config = getConfig(packageType);
  const { state } = config.get();

  const { actionClasses = [] } = state ?? {};

  const noCodePageViewActionClasses = actionClasses.filter(
    (action) => action.type === "noCode" && action.noCodeConfig?.type === "pageView"
  );

  for (const event of noCodePageViewActionClasses) {
    const urlFilters = event.noCodeConfig?.urlFilters ?? [];
    const isValidUrl = handleUrlFilters(urlFilters);

    if (!isValidUrl) continue;

    const trackNoCodeAction = getNoCodeActionTracker(packageType);
    const trackResult = await trackNoCodeAction(event.name);
    if (trackResult.ok !== true) return err(trackResult.error);
  }

  return okVoid();
};

const checkPageUrlWrapper = (packageType: TJsPackageType) => checkPageUrl(packageType);

export const addPageUrlEventListeners = (packageType: TJsPackageType): void => {
  if (typeof window === "undefined" || arePageUrlEventListenersAdded) return;
  events.forEach((event) => window.addEventListener(event, () => checkPageUrlWrapper(packageType)));
  arePageUrlEventListenersAdded = true;
};

export const removePageUrlEventListeners = (packageType: TJsPackageType): void => {
  if (typeof window === "undefined" || !arePageUrlEventListenersAdded) return;
  events.forEach((event) => window.removeEventListener(event, () => checkPageUrlWrapper(packageType)));
  arePageUrlEventListenersAdded = false;
};

// Click Event Handlers
let isClickEventListenerAdded = false;

const checkClickMatch = (event: MouseEvent, packageType: TJsPackageType) => {
  const config = getConfig(packageType);
  const { state } = config.get();
  if (!state) return;

  const { actionClasses = [] } = state;
  const noCodeClickActionClasses = actionClasses.filter(
    (action) => action.type === "noCode" && action.noCodeConfig?.type === "click"
  );

  const targetElement = event.target as HTMLElement;

  const trackNoCodeAction = getNoCodeActionTracker(packageType);

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

const checkClickMatchWrapper = (e: MouseEvent, packageType: TJsPackageType) =>
  checkClickMatch(e, packageType);

export const addClickEventListener = (packageType: TJsPackageType): void => {
  if (typeof window === "undefined" || isClickEventListenerAdded) return;
  document.addEventListener("click", (e) => checkClickMatchWrapper(e, packageType));
  isClickEventListenerAdded = true;
};

export const removeClickEventListener = (packageType: TJsPackageType): void => {
  if (!isClickEventListenerAdded) return;
  document.removeEventListener("click", (e) => checkClickMatchWrapper(e, packageType));
  isClickEventListenerAdded = false;
};

// Exit Intent Handlers
let isExitIntentListenerAdded = false;

const checkExitIntent = async (e: MouseEvent, packageType: TJsPackageType) => {
  const config = getConfig(packageType);
  const { state } = config.get();
  const { actionClasses = [] } = state ?? {};

  const trackNoCodeAction = getNoCodeActionTracker(packageType);

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

const checkExitIntentWrapper = (e: MouseEvent, packageType: TJsPackageType) =>
  checkExitIntent(e, packageType);

export const addExitIntentListener = (packageType: TJsPackageType): void => {
  if (typeof document !== "undefined" && !isExitIntentListenerAdded) {
    document
      .querySelector("body")!
      .addEventListener("mouseleave", (e) => checkExitIntentWrapper(e, packageType));
    isExitIntentListenerAdded = true;
  }
};

export const removeExitIntentListener = (packageType: TJsPackageType): void => {
  if (isExitIntentListenerAdded) {
    document.removeEventListener("mouseleave", (e) => checkExitIntentWrapper(e, packageType));
    isExitIntentListenerAdded = false;
  }
};

// Scroll Depth Handlers
let scrollDepthListenerAdded = false;
let scrollDepthTriggered = false;

const checkScrollDepth = async (packageType: TJsPackageType) => {
  const scrollPosition = window.scrollY;
  const windowSize = window.innerHeight;
  const bodyHeight = document.documentElement.scrollHeight;

  if (scrollPosition === 0) {
    scrollDepthTriggered = false;
  }

  if (!scrollDepthTriggered && scrollPosition / (bodyHeight - windowSize) >= 0.5) {
    scrollDepthTriggered = true;

    const config = getConfig(packageType);

    const { state } = config.get();
    const { actionClasses = [] } = state ?? {};

    const trackNoCodeAction = getNoCodeActionTracker(packageType);

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

const checkScrollDepthWrapper = (packageType: TJsPackageType) => checkScrollDepth(packageType);

export const addScrollDepthListener = (packageType: TJsPackageType): void => {
  if (typeof window !== "undefined" && !scrollDepthListenerAdded) {
    window.addEventListener("load", () => {
      window.addEventListener("scroll", () => checkScrollDepthWrapper(packageType));
    });
    scrollDepthListenerAdded = true;
  }
};

export const removeScrollDepthListener = (packageType: TJsPackageType): void => {
  if (scrollDepthListenerAdded) {
    window.removeEventListener("scroll", () => checkScrollDepthWrapper(packageType));
    scrollDepthListenerAdded = false;
  }
};
