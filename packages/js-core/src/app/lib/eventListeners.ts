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
  addPageUrlEventListeners("app");
  addClickEventListener("app");
  addExitIntentListener("app");
  addScrollDepthListener("app");
};

export const addCleanupEventListeners = (): void => {
  if (areRemoveEventListenersAdded) return;
  window.addEventListener("beforeunload", () => {
    removeExpiryCheckListener();
    removePageUrlEventListeners("app");
    removeClickEventListener("app");
    removeExitIntentListener("app");
    removeScrollDepthListener("app");
  });
  areRemoveEventListenersAdded = true;
};

export const removeCleanupEventListeners = (): void => {
  if (!areRemoveEventListenersAdded) return;
  window.removeEventListener("beforeunload", () => {
    removeExpiryCheckListener();
    removePageUrlEventListeners("app");
    removeClickEventListener("app");
    removeExitIntentListener("app");
    removeScrollDepthListener("app");
  });
  areRemoveEventListenersAdded = false;
};

export const removeAllEventListeners = (): void => {
  removeExpiryCheckListener();
  removePageUrlEventListeners("app");
  removeClickEventListener("app");
  removeExitIntentListener("app");
  removeScrollDepthListener("app");
  removeCleanupEventListeners();
};
