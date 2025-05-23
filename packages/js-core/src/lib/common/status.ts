import { Logger } from "@/lib/common/logger";
import { type NotSetupError, type Result, err, okVoid } from "@/types/error";

let isSetup = false;

export const setIsSetup = (state: boolean): void => {
  isSetup = state;
};

export const getIsSetup = (): boolean => {
  return isSetup;
};

export const checkSetup = (): Result<void, NotSetupError> => {
  const logger = Logger.getInstance();
  logger.debug("Check if set up");

  if (!isSetup) {
    return err({
      code: "not_setup",
      message: "Formbricks is not set up. Call setup() first.",
    });
  }

  return okVoid();
};
