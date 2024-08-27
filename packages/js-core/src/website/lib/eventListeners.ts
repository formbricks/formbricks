import {
  addEnvironmentStateExpiryCheckListener,
  clearEnvironmentStateExpiryCheckListener,
} from "../../shared/environmentState";
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
import { WebsiteConfig } from "./config";

let areRemoveEventListenersAdded = false;

export const addEventListeners = (config: WebsiteConfig): void => {
  addEnvironmentStateExpiryCheckListener("website", config);
  clearEnvironmentStateExpiryCheckListener();
  addPageUrlEventListeners();
  addClickEventListener();
  addExitIntentListener();
  addScrollDepthListener();
};

export const addCleanupEventListeners = (): void => {
  if (areRemoveEventListenersAdded) return;
  window.addEventListener("beforeunload", () => {
    clearEnvironmentStateExpiryCheckListener();
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
    clearEnvironmentStateExpiryCheckListener();
    removePageUrlEventListeners();
    removeClickEventListener();
    removeExitIntentListener();
    removeScrollDepthListener();
  });
  areRemoveEventListenersAdded = false;
};

export const removeAllEventListeners = (): void => {
  clearEnvironmentStateExpiryCheckListener();
  removePageUrlEventListeners();
  removeClickEventListener();
  removeExitIntentListener();
  removeScrollDepthListener();
  removeCleanupEventListeners();
};
