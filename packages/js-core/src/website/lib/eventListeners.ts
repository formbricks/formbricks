import {
  addClickEventListener,
  addExitIntentListener,
  addPageUrlEventListeners,
  addScrollDepthListener,
  removeClickEventListener,
  removeExitIntentListener,
  removePageUrlEventListeners,
  removeScrollDepthListener,
} from "../../shared/noCodeActions";
import { addExpiryCheckListener, removeExpiryCheckListener } from "./sync";

let areRemoveEventListenersAdded = false;

export const addEventListeners = (): void => {
  addExpiryCheckListener();
  addPageUrlEventListeners("website");
  addClickEventListener("website");
  addExitIntentListener("website");
  addScrollDepthListener("website");
};

export const addCleanupEventListeners = (): void => {
  if (areRemoveEventListenersAdded) return;
  window.addEventListener("beforeunload", () => {
    removeExpiryCheckListener();
    removePageUrlEventListeners("website");
    removeClickEventListener("website");
    removeExitIntentListener("website");
    removeScrollDepthListener("website");
  });
  areRemoveEventListenersAdded = true;
};

export const removeCleanupEventListeners = (): void => {
  if (!areRemoveEventListenersAdded) return;
  window.removeEventListener("beforeunload", () => {
    removeExpiryCheckListener();
    removePageUrlEventListeners("website");
    removeClickEventListener("website");
    removeExitIntentListener("website");
    removeScrollDepthListener("website");
  });
  areRemoveEventListenersAdded = false;
};

export const removeAllEventListeners = (): void => {
  removeExpiryCheckListener();
  removePageUrlEventListeners("website");
  removeClickEventListener("website");
  removeExitIntentListener("website");
  removeScrollDepthListener("website");
  removeCleanupEventListeners();
};
