import {
  addEnvironmentStateExpiryCheckListener,
  clearEnvironmentStateExpiryCheckListener,
} from "./environment-state";
import { addUserStateExpiryCheckListener, clearUserStateExpiryCheckListener } from "./user-state";

let areRemoveEventListenersAdded = false;

export const addEventListeners = (): void => {
  addEnvironmentStateExpiryCheckListener();
  addUserStateExpiryCheckListener();
};

export const addCleanupEventListeners = (): void => {
  if (areRemoveEventListenersAdded) return;
  clearEnvironmentStateExpiryCheckListener();
  clearUserStateExpiryCheckListener();
  areRemoveEventListenersAdded = true;
};

export const removeCleanupEventListeners = (): void => {
  if (!areRemoveEventListenersAdded) return;
  clearEnvironmentStateExpiryCheckListener();
  clearUserStateExpiryCheckListener();
  areRemoveEventListenersAdded = false;
};

export const removeAllEventListeners = (): void => {
  clearEnvironmentStateExpiryCheckListener();
  clearUserStateExpiryCheckListener();
  removeCleanupEventListeners();
};
