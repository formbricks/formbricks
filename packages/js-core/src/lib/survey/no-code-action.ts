/* eslint-disable no-console -- required for logging */
import { CommandQueue, CommandType } from "@/lib/common/command-queue";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { TimeoutStack } from "@/lib/common/timeout-stack";
import { evaluateNoCodeConfigClick, handleUrlFilters } from "@/lib/common/utils";
import { trackNoCodeAction } from "@/lib/survey/action";
import { setIsSurveyRunning } from "@/lib/survey/widget";
import { type Result } from "@/types/error";

// Factory for creating context-specific tracking handlers
export const createTrackNoCodeActionWithContext = (context: string) => {
  return async (actionName: string): Promise<Result<void, unknown>> => {
    const result = await trackNoCodeAction(actionName);
    if (!result.ok) {
      const errorToLog = result.error as { message?: string };
      const errorMessageText = errorToLog.message ?? "An unknown error occurred.";
      console.error(
        `🧱 Formbricks - Error in no-code ${context} action '${actionName}': ${errorMessageText}`,
        errorToLog
      );
    }
    return result;
  };
};

const trackNoCodePageViewActionHandler = createTrackNoCodeActionWithContext("page view");
const trackNoCodeClickActionHandler = createTrackNoCodeActionWithContext("click");
const trackNoCodeExitIntentActionHandler = createTrackNoCodeActionWithContext("exit intent");
const trackNoCodeScrollActionHandler = createTrackNoCodeActionWithContext("scroll");

// Event types for various listeners
const events = ["hashchange", "popstate", "pushstate", "replacestate", "load"];

// Page URL Event Handlers
let arePageUrlEventListenersAdded = false;
let isHistoryPatched = false;
export const setIsHistoryPatched = (value: boolean): void => {
  isHistoryPatched = value;
};

export const checkPageUrl = async (): Promise<Result<void, unknown>> => {
  const queue = CommandQueue.getInstance();
  const appConfig = Config.getInstance();
  const logger = Logger.getInstance();
  const timeoutStack = TimeoutStack.getInstance();

  logger.debug(`Checking page url: ${window.location.href}`);
  const actionClasses = appConfig.get().environment.data.actionClasses;

  const noCodePageViewActionClasses = actionClasses.filter(
    (action) => action.type === "noCode" && action.noCodeConfig?.type === "pageView"
  );

  for (const event of noCodePageViewActionClasses) {
    const urlFilters = event.noCodeConfig?.urlFilters ?? [];
    const isValidUrl = handleUrlFilters(urlFilters);

    if (isValidUrl) {
      await queue.add(trackNoCodePageViewActionHandler, CommandType.GeneralAction, true, event.name);
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

  return { ok: true, data: undefined };
};

const checkPageUrlWrapper = (): void => {
  void checkPageUrl();
};

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

const checkClickMatch = async (event: MouseEvent): Promise<void> => {
  const queue = CommandQueue.getInstance();
  const appConfig = Config.getInstance();

  const { environment } = appConfig.get();

  const { actionClasses = [] } = environment.data;

  const noCodeClickActionClasses = actionClasses.filter(
    (action) => action.type === "noCode" && action.noCodeConfig?.type === "click"
  );

  const targetElement = event.target as HTMLElement;

  for (const action of noCodeClickActionClasses) {
    if (evaluateNoCodeConfigClick(targetElement, action)) {
      await queue.add(trackNoCodeClickActionHandler, CommandType.GeneralAction, true, action.name);
    }
  }
};

const checkClickMatchWrapper = (e: MouseEvent): void => {
  void checkClickMatch(e);
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

const checkExitIntent = async (e: MouseEvent): Promise<void> => {
  const queue = CommandQueue.getInstance();
  const appConfig = Config.getInstance();

  const { environment } = appConfig.get();
  const { actionClasses = [] } = environment.data;

  const noCodeExitIntentActionClasses = actionClasses.filter(
    (action) => action.type === "noCode" && action.noCodeConfig?.type === "exitIntent"
  );

  if (e.clientY <= 0 && noCodeExitIntentActionClasses.length > 0) {
    for (const event of noCodeExitIntentActionClasses) {
      const urlFilters = event.noCodeConfig?.urlFilters ?? [];
      const isValidUrl = handleUrlFilters(urlFilters);

      if (!isValidUrl) continue;

      await queue.add(trackNoCodeExitIntentActionHandler, CommandType.GeneralAction, true, event.name);
    }
  }
};

const checkExitIntentWrapper = (e: MouseEvent): void => {
  void checkExitIntent(e);
};

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

const checkScrollDepth = async (): Promise<void> => {
  const queue = CommandQueue.getInstance();
  const appConfig = Config.getInstance();

  const scrollPosition = window.scrollY;
  const windowSize = window.innerHeight;
  const bodyHeight = document.documentElement.scrollHeight;

  if (scrollPosition === 0) {
    scrollDepthTriggered = false;
  }

  if (!scrollDepthTriggered && scrollPosition / (bodyHeight - windowSize) >= 0.5) {
    scrollDepthTriggered = true;

    const { environment } = appConfig.get();
    const { actionClasses = [] } = environment.data;

    const noCodefiftyPercentScrollActionClasses = actionClasses.filter(
      (action) => action.type === "noCode" && action.noCodeConfig?.type === "fiftyPercentScroll"
    );

    for (const event of noCodefiftyPercentScrollActionClasses) {
      const urlFilters = event.noCodeConfig?.urlFilters ?? [];
      const isValidUrl = handleUrlFilters(urlFilters);

      if (!isValidUrl) continue;

      await queue.add(trackNoCodeScrollActionHandler, CommandType.GeneralAction, true, event.name);
    }
  }
};

const checkScrollDepthWrapper = (): void => {
  void checkScrollDepth();
};

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
