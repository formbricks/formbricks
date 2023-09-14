import type { InitConfig } from "../../../types/js";
import { addExitIntentListener, addScrollDepthListener } from "./automaticActions";
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
import { Logger } from "./logger";
import { addClickEventListener, addPageUrlEventListeners, checkPageUrl } from "./noCodeEvents";
import { resetPerson } from "./person";
import { isExpired } from "./session";
import { sync } from "./sync";
import { addWidgetContainer } from "./widget";

const config = Config.getInstance();
const logger = Logger.getInstance();

let syncIntervalId: number | null = null;

const addSyncEventListener = (debug?: boolean): void => {
  const updateInverval = debug ? 1000 * 30 : 1000 * 60 * 2; // 2 minutes in production, 30 seconds in debug mode
  // add event listener to check sync with backend on regular interval
  if (typeof window !== "undefined") {
    // clear any existing interval
    if (syncIntervalId !== null) {
      window.clearInterval(syncIntervalId);
    }
    syncIntervalId = window.setInterval(async () => {
      if (!config.isSyncAllowed) {
        return;
      }
      logger.debug("Syncing.");
      await sync();
    }, updateInverval);
    // clear interval on page unload
    window.addEventListener("beforeunload", () => {
      if (syncIntervalId !== null) {
        window.clearInterval(syncIntervalId);
      }
    });
  }
};

export const initialize = async (
  c: InitConfig
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  if (c.debug) {
    logger.debug(`Setting log level to debug`);
    logger.configure({ logLevel: "debug" });
  }

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

  logger.debug("Add session event listeners");
  addSyncEventListener(c.debug);

  logger.debug("Add page url event listeners");
  addPageUrlEventListeners();

  logger.debug("Add click event listeners");
  addClickEventListener();

  logger.debug("Add exit intent (Desktop) listener");
  addExitIntentListener();

  logger.debug("Add scroll depth 50% listener");
  addScrollDepthListener();

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
