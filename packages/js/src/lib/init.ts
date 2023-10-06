import type { TJsConfigInput } from "@formbricks/types/v1/js";
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

  const localConfigResult = config.loadFromLocalStorage();

  if (
    localConfigResult.ok &&
    localConfigResult.value.state &&
    localConfigResult.value.environmentId === c.environmentId &&
    localConfigResult.value.apiHost === c.apiHost
  ) {
    const { state, apiHost, environmentId } = localConfigResult.value;

    logger.debug("Found existing configuration. Checking session.");
    const existingSession = state.session;

    config.update(localConfigResult.value);

    if (isExpired(existingSession)) {
      logger.debug("Session expired. Resyncing.");

      try {
        await sync({
          apiHost,
          environmentId,
          personId: state.person.id,
          sessionId: existingSession.id,
        });
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

    logger.debug("Syncing.");
    await sync({
      apiHost: c.apiHost,
      environmentId: c.environmentId,
    });
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
