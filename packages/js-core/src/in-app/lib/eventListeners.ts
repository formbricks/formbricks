import {
  addExitIntentListener,
  addScrollDepthListener,
  removeExitIntentListener,
  removeScrollDepthListener,
} from "../../shared/automaticActions";
import {
  addClickEventListener,
  addPageUrlEventListeners,
  removeClickEventListener,
  removePageUrlEventListeners,
} from "./noCodeActions";
import { addExpiryCheckListener, removeExpiryCheckListener } from "./sync";

let areRemoveEventListenersAdded = false;

export const addEventListeners = (): void => {
  addExpiryCheckListener();
  addPageUrlEventListeners();
  addClickEventListener();
  addExitIntentListener();
  addScrollDepthListener("in-app");
};

export const addCleanupEventListeners = (): void => {
  if (areRemoveEventListenersAdded) return;
  window.addEventListener("beforeunload", () => {
    removeExpiryCheckListener();
    removePageUrlEventListeners();
    removeClickEventListener();
    removeExitIntentListener();
    removeScrollDepthListener("in-app");
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
    removeScrollDepthListener("in-app");
  });
  areRemoveEventListenersAdded = false;
};

export const removeAllEventListeners = (): void => {
  removeExpiryCheckListener();
  removePageUrlEventListeners();
  removeClickEventListener();
  removeExitIntentListener();
  removeScrollDepthListener("in-app");
  removeCleanupEventListeners();
};
