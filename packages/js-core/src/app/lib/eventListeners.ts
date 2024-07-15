import {
  addClickEventListener,
  addExitIntentListener,
  addPageUrlEventListeners,
  addScrollDepthListener,
  removeClickEventListener,
  removeExitIntentListener,
  removePageUrlEventListeners,
  removeScrollDepthListener,
} from "../lib/noCodeActions";
import { addExpiryCheckListener, removeExpiryCheckListener } from "./sync";

let areRemoveEventListenersAdded = false;

export const addEventListeners = (): void => {
  addExpiryCheckListener();
  addPageUrlEventListeners();
  addClickEventListener();
  addExitIntentListener();
  addScrollDepthListener();
};

export const addCleanupEventListeners = (): void => {
  if (areRemoveEventListenersAdded) return;
  window.addEventListener("beforeunload", () => {
    removeExpiryCheckListener();
    removePageUrlEventListeners();
    removeClickEventListener();
    removeExitIntentListener();
    removeScrollDepthListener();
  });
  areRemoveEventListenersAdded = true;
};

export const removeCleanupEventListeners = (): void => {
  if (!areRemoveEventListenersAdded) return;
  window.removeEventListener("beforeunload", () => {
    removeExpiryCheckListener();
    removePageUrlEventListeners();
    removeClickEventListener();
    removeExitIntentListener();
    removeScrollDepthListener();
  });
  areRemoveEventListenersAdded = false;
};

export const removeAllEventListeners = (): void => {
  removeExpiryCheckListener();
  removePageUrlEventListeners();
  removeClickEventListener();
  removeExitIntentListener();
  removeScrollDepthListener();
  removeCleanupEventListeners();
};
