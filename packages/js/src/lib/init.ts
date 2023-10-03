import type { InitConfig } from "../../../types/js";
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
import { addCleanupEventListeners, addEventListeners } from "./eventListeners";
import { Logger } from "./logger";
import { checkPageUrl } from "./noCodeEvents";
import { resetPerson } from "./person";
import { isExpired } from "./session";
import { sync } from "./sync";
import { addWidgetContainer } from "./widget";

const config = Config.getInstance();
const logger = Logger.getInstance();

let isInitialized = false;

const setDebugLevel = (c: InitConfig): void => {
  if (c.debug) {
    logger.debug(`Setting log level to debug`);
    logger.configure({ logLevel: "debug" });
  }
};

export const initialize = async (
  c: InitConfig
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  if (isInitialized) {
    logger.debug("Already initialized, skipping initialization.");
    return okVoid();
  }

  setDebugLevel(c);

  ErrorHandler.getInstance().printStatus();

  logger.debug("Start initialize");
  config.allowSync();

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

  logger.debug("Adding styles to DOM");
  if (
    config.get().state &&
    config.get().environmentId === c.environmentId &&
    config.get().apiHost === c.apiHost
  ) {
    logger.debug("Found existing configuration. Checking session.");
    const existingSession = config.get().state.session;
    if (isExpired(existingSession)) {
      logger.debug("Session expired. Resyncing.");

      try {
        await sync();
      } catch (e) {
        logger.debug("Sync failed. Clearing config and starting from scratch.");
        await resetPerson();
        return await initialize(c);
      }
    } else {
      logger.debug("Session valid. Continuing.");
      // continue for now - next sync will check complete state
    }
  } else {
    logger.debug("No valid configuration found. Creating new config.");
    // we need new config
    config.update({ environmentId: c.environmentId, apiHost: c.apiHost, state: undefined });

    logger.debug("Syncing.");
    await sync();
  }

  logger.debug("Adding event listeners");
  addEventListeners(c.debug);
  addCleanupEventListeners();

  isInitialized = true;
  logger.debug("Initialized");

  // check page url if initialized after page load
  checkPageUrl();
  return okVoid();
};

export const checkInitialized = (): Result<void, NotInitializedError> => {
  logger.debug("Check if initialized");
  if (
    !config.get().apiHost ||
    !config.get().environmentId ||
    !config.get().state ||
    !ErrorHandler.initialized
  ) {
    return err({
      code: "not_initialized",
      message: "Formbricks not initialized. Call initialize() first.",
    });
  }

  return okVoid();
};
