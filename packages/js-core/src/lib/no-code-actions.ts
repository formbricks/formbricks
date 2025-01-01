import { type TJsEnvironmentStateActionClass } from "@formbricks/types/js";
import { trackNoCodeAction } from "./actions";
import { Config } from "./config";
import { ErrorHandler, type NetworkError, type Result, type ResultError, err, match, okVoid } from "./errors";
import { Logger } from "./logger";
import { TimeoutStack } from "./timeout-stack";
import { evaluateNoCodeConfigClick, handleUrlFilters } from "./utils";
import { setIsSurveyRunning } from "./widget";

const appConfig = Config.getInstance();
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();
const timeoutStack = TimeoutStack.getInstance();

// Event types for various listeners
const events = ["hashchange", "popstate", "pushstate", "replacestate", "load"];

// Page URL Event Handlers
let arePageUrlEventListenersAdded = false;
let isHistoryPatched = false;
export const setIsHistoryPatched = (value: boolean): void => {
  isHistoryPatched = value;
};

export const checkPageUrl = async (): Promise<Result<void, NetworkError>> => {
  logger.debug(`Checking page url: ${window.location.href}`);
  const actionClasses = appConfig.get().environmentState.data.actionClasses;

  const noCodePageViewActionClasses = actionClasses.filter(
    (action) => action.type === "noCode" && action.noCodeConfig?.type === "pageView"
  );

  for (const event of noCodePageViewActionClasses) {
    const urlFilters = event.noCodeConfig?.urlFilters ?? [];
    const isValidUrl = handleUrlFilters(urlFilters);

    if (isValidUrl) {
      const trackResult = await trackNoCodeAction(event.name);

      if (!trackResult.ok) {
        return err(trackResult.error);
      }
    } else {
      const scheduledTimeouts = timeoutStack.getTimeouts();

      const scheduledTimeout = scheduledTimeouts.find((timeout) => timeout.event === event.name);
      // If invalid, clear if it's scheduled
      if (scheduledTimeout) {
        timeoutStack.remove(scheduledTimeout.timeoutId);
        setIsSurveyRunning(false);
      }
    }
  }

  return okVoid();
};

const checkPageUrlWrapper = (): ReturnType<typeof checkPageUrl> => checkPageUrl();

export const addPageUrlEventListeners = (): void => {
  if (typeof window === "undefined" || arePageUrlEventListenersAdded) return;

  // Monkey patch history methods if not already done
  if (!isHistoryPatched) {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- We need to access the original method
    const originalPushState = history.pushState;

    // eslint-disable-next-line func-names -- We need an anonymous function here
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      const event = new Event("pushstate");
      window.dispatchEvent(event);
    };

    isHistoryPatched = true;
  }

  events.forEach((event) => {
    window.addEventListener(event, checkPageUrlWrapper as EventListener);
  });
  arePageUrlEventListenersAdded = true;
};

export const removePageUrlEventListeners = (): void => {
  if (typeof window === "undefined" || !arePageUrlEventListenersAdded) return;
  events.forEach((event) => {
    window.removeEventListener(event, checkPageUrlWrapper as EventListener);
  });
  arePageUrlEventListenersAdded = false;
};

// Click Event Handlers
let isClickEventListenerAdded = false;

const checkClickMatch = (event: MouseEvent): void => {
  const { environmentState } = appConfig.get();

  const { actionClasses = [] } = environmentState.data;

  const noCodeClickActionClasses = actionClasses.filter(
    (action) => action.type === "noCode" && action.noCodeConfig?.type === "click"
  );

  const targetElement = event.target as HTMLElement;

  noCodeClickActionClasses.forEach((action: TJsEnvironmentStateActionClass) => {
    if (evaluateNoCodeConfigClick(targetElement, action)) {
      trackNoCodeAction(action.name)
        .then((res) => {
          match(
            res,
            (_value: unknown) => undefined,
            (actionError: unknown) => {
              errorHandler.handle(actionError);
            }
          );
        })
        .catch((error: unknown) => {
          errorHandler.handle(error);
        });
    }
  });
};

const checkClickMatchWrapper = (e: MouseEvent): void => {
  checkClickMatch(e);
};

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

const checkExitIntent = async (e: MouseEvent): Promise<ResultError<NetworkError> | undefined> => {
  const { environmentState } = appConfig.get();
  const { actionClasses = [] } = environmentState.data;

  const noCodeExitIntentActionClasses = actionClasses.filter(
    (action) => action.type === "noCode" && action.noCodeConfig?.type === "exitIntent"
  );

  if (e.clientY <= 0 && noCodeExitIntentActionClasses.length > 0) {
    for (const event of noCodeExitIntentActionClasses) {
      const urlFilters = event.noCodeConfig?.urlFilters ?? [];
      const isValidUrl = handleUrlFilters(urlFilters);

      if (!isValidUrl) continue;

      const trackResult = await trackNoCodeAction(event.name);
      if (!trackResult.ok) return err(trackResult.error);
    }
  }
};

const checkExitIntentWrapper = (e: MouseEvent): ReturnType<typeof checkExitIntent> => checkExitIntent(e);

export const addExitIntentListener = (): void => {
  if (typeof document !== "undefined" && !isExitIntentListenerAdded) {
    document
      .querySelector("body")
      ?.addEventListener("mouseleave", checkExitIntentWrapper as unknown as EventListener);
    isExitIntentListenerAdded = true;
  }
};

export const removeExitIntentListener = (): void => {
  if (isExitIntentListenerAdded) {
    document.removeEventListener("mouseleave", checkExitIntentWrapper as unknown as EventListener);
    isExitIntentListenerAdded = false;
  }
};

// Scroll Depth Handlers
let scrollDepthListenerAdded = false;
let scrollDepthTriggered = false;

const checkScrollDepth = async (): Promise<Result<void, unknown>> => {
  const scrollPosition = window.scrollY;
  const windowSize = window.innerHeight;
  const bodyHeight = document.documentElement.scrollHeight;

  if (scrollPosition === 0) {
    scrollDepthTriggered = false;
  }

  if (!scrollDepthTriggered && scrollPosition / (bodyHeight - windowSize) >= 0.5) {
    scrollDepthTriggered = true;

    const { environmentState } = appConfig.get();
    const { actionClasses = [] } = environmentState.data;

    const noCodefiftyPercentScrollActionClasses = actionClasses.filter(
      (action) => action.type === "noCode" && action.noCodeConfig?.type === "fiftyPercentScroll"
    );

    for (const event of noCodefiftyPercentScrollActionClasses) {
      const urlFilters = event.noCodeConfig?.urlFilters ?? [];
      const isValidUrl = handleUrlFilters(urlFilters);

      if (!isValidUrl) continue;

      const trackResult = await trackNoCodeAction(event.name);
      if (!trackResult.ok) return err(trackResult.error);
    }
  }

  return okVoid();
};

const checkScrollDepthWrapper = (): ReturnType<typeof checkScrollDepth> => checkScrollDepth();

export const addScrollDepthListener = (): void => {
  if (typeof window !== "undefined" && !scrollDepthListenerAdded) {
    if (document.readyState === "complete") {
      window.addEventListener("scroll", checkScrollDepthWrapper as EventListener);
    } else {
      window.addEventListener("load", () => {
        window.addEventListener("scroll", checkScrollDepthWrapper as EventListener);
      });
    }
    scrollDepthListenerAdded = true;
  }
};

export const removeScrollDepthListener = (): void => {
  if (scrollDepthListenerAdded) {
    window.removeEventListener("scroll", checkScrollDepthWrapper as EventListener);
    scrollDepthListenerAdded = false;
  }
};
