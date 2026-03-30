import {
  addEnvironmentStateExpiryCheckListener,
  clearEnvironmentStateExpiryCheckListener,
} from "@/lib/environment/state";
import {
  addClickEventListener,
  addExitIntentListener,
  addPageUrlEventListeners,
  addScrollDepthListener,
  clearTimeOnPageTimers,
  removeClickEventListener,
  removeExitIntentListener,
  removePageUrlEventListeners,
  removeScrollDepthListener,
} from "@/lib/survey/no-code-action";
import { addUserStateExpiryCheckListener, clearUserStateExpiryCheckListener } from "@/lib/user/state";

let areRemoveEventListenersAdded = false;

export const addEventListeners = (): void => {
  addEnvironmentStateExpiryCheckListener();
  addUserStateExpiryCheckListener();
  addPageUrlEventListeners();
  addClickEventListener();
  addExitIntentListener();
  addScrollDepthListener();
};

export const addCleanupEventListeners = (): void => {
  if (areRemoveEventListenersAdded) return;
  window.addEventListener("beforeunload", () => {
    clearEnvironmentStateExpiryCheckListener();
    clearUserStateExpiryCheckListener();
    removePageUrlEventListeners();
    removeClickEventListener();
    removeExitIntentListener();
    removeScrollDepthListener();
    clearTimeOnPageTimers();
  });
  areRemoveEventListenersAdded = true;
};

export const removeCleanupEventListeners = (): void => {
  if (!areRemoveEventListenersAdded) return;
  window.removeEventListener("beforeunload", () => {
    clearEnvironmentStateExpiryCheckListener();
    clearUserStateExpiryCheckListener();
    removePageUrlEventListeners();
    removeClickEventListener();
    removeExitIntentListener();
    removeScrollDepthListener();
    clearTimeOnPageTimers();
  });
  areRemoveEventListenersAdded = false;
};

export const removeAllEventListeners = (): void => {
  clearEnvironmentStateExpiryCheckListener();
  clearUserStateExpiryCheckListener();
  removePageUrlEventListeners();
  removeClickEventListener();
  removeExitIntentListener();
  removeScrollDepthListener();
  clearTimeOnPageTimers();
  removeCleanupEventListeners();
};
