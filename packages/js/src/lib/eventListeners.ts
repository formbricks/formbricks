import {
  addExitIntentListener,
  addScrollDepthListener,
  removeExitIntentListener,
  removeScrollDepthListener,
} from "./automaticActions";
import {
  addClickEventListener,
  addPageUrlEventListeners,
  removeClickEventListener,
  removePageUrlEventListeners,
} from "./noCodeEvents";
import { addSyncEventListener, removeSyncEventListener } from "./sync";

let areRemoveEventListenersAdded = false;

export const addEventListeners = (debug: boolean = false): void => {
  addSyncEventListener(debug);
  addPageUrlEventListeners();
  addClickEventListener();
  addExitIntentListener();
  addScrollDepthListener();
};

export const addCleanupEventListeners = (): void => {
  if (areRemoveEventListenersAdded) return;
  window.addEventListener("beforeunload", () => {
    removeSyncEventListener();
    removePageUrlEventListeners();
    removeClickEventListener();
    removeExitIntentListener();
    removeScrollDepthListener();
  });
  areRemoveEventListenersAdded = true;
};
