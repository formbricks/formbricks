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
import {
  addWorkspaceStateExpiryCheckListener,
  clearWorkspaceStateExpiryCheckListener,
} from "@/lib/workspace/state";

let areRemoveEventListenersAdded = false;

export const addEventListeners = (): void => {
  addWorkspaceStateExpiryCheckListener();
  addUserStateExpiryCheckListener();
  addPageUrlEventListeners();
  addClickEventListener();
  addExitIntentListener();
  addScrollDepthListener();
};

export const addCleanupEventListeners = (): void => {
  if (areRemoveEventListenersAdded) return;
  window.addEventListener("beforeunload", () => {
    clearWorkspaceStateExpiryCheckListener();
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
    clearWorkspaceStateExpiryCheckListener();
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
  clearWorkspaceStateExpiryCheckListener();
  clearUserStateExpiryCheckListener();
  removePageUrlEventListeners();
  removeClickEventListener();
  removeExitIntentListener();
  removeScrollDepthListener();
  clearTimeOnPageTimers();
  removeCleanupEventListeners();
};
