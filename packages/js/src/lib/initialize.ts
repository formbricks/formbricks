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

    // conditions in which the local storage is valid?
    // public -> no person, existing surveys, existing displays
    // identified users -> existing person, existing surveys

    if (!existingSession || !state.person?.id) {
      logger.debug("No session or person found. This is an unidentified user, checking for displays");
      if (state.displays && state.displays?.length > 0) {
        logger.debug("Found existing displays.");
        config.update(localConfigResult.value);
      } else {
        logger.debug("No existing displays found. Syncing.");
        await sync({
          apiHost,
          environmentId,
        });
      }
    } else {
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
    }
  } else {
    logger.debug("No valid configuration found or it has been expired. Creating new config.");

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
