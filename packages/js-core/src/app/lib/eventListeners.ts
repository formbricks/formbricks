import {
  addEnvironmentStateExpiryCheckListener,
  clearEnvironmentStateExpiryCheckListener,
} from "../../shared/environmentState";
import {
  addPersonStateExpiryCheckListener,
  clearPersonStateExpiryCheckListener,
} from "../../shared/personState";
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
import { AppConfig } from "./config";

let areRemoveEventListenersAdded = false;

export const addEventListeners = (config: AppConfig): void => {
  addEnvironmentStateExpiryCheckListener("app", config);
  addPersonStateExpiryCheckListener(config);
  addPageUrlEventListeners();
  addClickEventListener();
  addExitIntentListener();
  addScrollDepthListener();
};

export const addCleanupEventListeners = (): void => {
  if (areRemoveEventListenersAdded) return;
  window.addEventListener("beforeunload", () => {
    clearEnvironmentStateExpiryCheckListener();
    clearPersonStateExpiryCheckListener();
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
    clearPersonStateExpiryCheckListener();
    removePageUrlEventListeners();
    removeClickEventListener();
    removeExitIntentListener();
    removeScrollDepthListener();
  });
  areRemoveEventListenersAdded = false;
};

export const removeAllEventListeners = (): void => {
  clearEnvironmentStateExpiryCheckListener();
  clearPersonStateExpiryCheckListener();
  removePageUrlEventListeners();
  removeClickEventListener();
  removeExitIntentListener();
  removeScrollDepthListener();
  removeCleanupEventListeners();
};
