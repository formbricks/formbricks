import type { TJsConfigInput } from "@formbricks/types/js";
import { Config } from "./config";
import {
  ErrorHandler,
  MissingFieldError,
  MissingPersonError,
  NetworkError,
  NotInitializedError,
  Result,
  err,
  okVoid,
} from "./errors";
import { addCleanupEventListeners, addEventListeners, removeAllEventListeners } from "./eventListeners";
import { Logger } from "./logger";
import { checkPageUrl } from "./noCodeActions";
import { sync } from "./sync";
import { addWidgetContainer } from "./widget";
import { trackAction } from "./actions";

const config = Config.getInstance();
const logger = Logger.getInstance();

let isInitialized = false;

const setDebugLevel = (c: TJsConfigInput): void => {
  if (c.debug) {
    logger.debug(`Setting log level to debug`);
    logger.configure({ logLevel: "debug" });
  }
};

export const initialize = async (
  c: TJsConfigInput
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  if (isInitialized) {
    logger.debug("Already initialized, skipping initialization.");
    return okVoid();
  }

  setDebugLevel(c);

  ErrorHandler.getInstance().printStatus();

  logger.debug("Start initialize");

  if (!c.environmentId) {
    logger.debug("No environmentId provided");
    return err({
      code: "missing_field",
      field: "environmentId",
    });
  }

  if (!c.apiHost) {
    logger.debug("No apiHost provided");

    return err({
      code: "missing_field",
      field: "apiHost",
    });
  }

  logger.debug("Adding widget container to DOM");
  addWidgetContainer();

  const localConfigResult = config.loadFromLocalStorage();

  if (
    localConfigResult.ok &&
    localConfigResult.value.state &&
    localConfigResult.value.environmentId === c.environmentId &&
    localConfigResult.value.apiHost === c.apiHost &&
    localConfigResult.value.state?.person?.userId === c.userId &&
    localConfigResult.value.expiresAt // only accept config when they follow new config version with expiresAt
  ) {
    logger.debug("Found existing configuration.");
    if (localConfigResult.value.expiresAt < new Date()) {
      logger.debug("Configuration expired.");
      await sync({
        apiHost: c.apiHost,
        environmentId: c.environmentId,
        userId: c.userId,
      });
    } else {
      logger.debug("Configuration not expired. Extending expiration.");
      config.update(localConfigResult.value);
    }
  } else {
    logger.debug("No valid configuration found or it has been expired. Creating new config.");
    logger.debug("Syncing.");

    // when the local storage is expired / empty, we sync to get the latest config

    await sync({
      apiHost: c.apiHost,
      environmentId: c.environmentId,
      userId: c.userId,
    });

    // and track the new session event
    trackAction("New Session");
  }

  logger.debug("Adding event listeners");
  addEventListeners();
  addCleanupEventListeners();

  isInitialized = true;
  logger.debug("Initialized");

  // check page url if initialized after page load

  checkPageUrl();
  return okVoid();
};

export const checkInitialized = (): Result<void, NotInitializedError> => {
  logger.debug("Check if initialized");
  if (!isInitialized || !ErrorHandler.initialized) {
    return err({
      code: "not_initialized",
      message: "Formbricks not initialized. Call initialize() first.",
    });
  }

  return okVoid();
};

export const deinitalize = (): void => {
  logger.debug("Deinitializing");
  removeAllEventListeners();
  config.resetConfig();
  isInitialized = false;
};
