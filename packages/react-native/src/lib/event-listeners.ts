import {
  addEnvironmentStateExpiryCheckListener,
  clearEnvironmentStateExpiryCheckListener,
} from "./environment-state";
import { addPersonStateExpiryCheckListener, clearPersonStateExpiryCheckListener } from "./person-state";

let areRemoveEventListenersAdded = false;

export const addEventListeners = (): void => {
  addEnvironmentStateExpiryCheckListener();
  addPersonStateExpiryCheckListener();
};

export const addCleanupEventListeners = (): void => {
  if (areRemoveEventListenersAdded) return;
  clearEnvironmentStateExpiryCheckListener();
  clearPersonStateExpiryCheckListener();
  areRemoveEventListenersAdded = true;
};

export const removeCleanupEventListeners = (): void => {
  if (!areRemoveEventListenersAdded) return;
  clearEnvironmentStateExpiryCheckListener();
  clearPersonStateExpiryCheckListener();
  areRemoveEventListenersAdded = false;
};

export const removeAllEventListeners = (): void => {
  clearEnvironmentStateExpiryCheckListener();
  clearPersonStateExpiryCheckListener();
  removeCleanupEventListeners();
};
