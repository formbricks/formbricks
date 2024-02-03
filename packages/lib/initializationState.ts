import { ErrorHandler, NotInitializedError, Result, err, okVoid } from "./errors";

export let isInitialized = false;

export const setIsInitialize = (state: boolean) => {
  isInitialized = state;
};

export const checkInitialized = (): Result<void, NotInitializedError> => {
  if (!isInitialized || !ErrorHandler.initialized) {
    return err({
      code: "not_initialized",
      message: "Formbricks not initialized. Call initialize() first.",
    });
  }

  return okVoid();
};
