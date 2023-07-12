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
import { trackAction } from "./actions";
import { Logger } from "./logger";
import { addClickEventListener, addPageUrlEventListeners, checkPageUrl } from "./noCodeEvents";
import { resetPerson } from "./person";
import { isExpired } from "./session";
import { addStylesToDom } from "./styles";
import { sync } from "./sync";
import { addWidgetContainer } from "./widget";

const config = Config.getInstance();
const logger = Logger.getInstance();

const addSyncEventListener = (): void => {
  // add event listener to check the session every minute
  if (typeof window !== "undefined") {
    const intervalId = window.setInterval(async () => {
      const syncResult = await sync();
      if (syncResult.ok !== true) {
        return err(syncResult.error);
      }
      const state = syncResult.value;
      config.update({ state });
    }, 1000 * 60); // check every minute
    // clear interval on page unload
    window.addEventListener("beforeunload", () => {
      clearInterval(intervalId);
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
  addStylesToDom();
  if (
    config.get().state &&
    config.get().environmentId === c.environmentId &&
    config.get().apiHost === c.apiHost
  ) {
    logger.debug("Found existing configuration. Checking session.");
    const existingSession = config.get().state.session;
    if (isExpired(existingSession)) {
      logger.debug("Session expired. Resyncing.");

      const syncResult = await sync();

      // if create sync fails, clear config and start from scratch
      if (syncResult.ok !== true) {
        await resetPerson();
        return await initialize(c);
      }

      const state = syncResult.value;

      config.update({ state });

      const trackActionResult = await trackAction("New Session");

      if (trackActionResult.ok !== true) return err(trackActionResult.error);
    } else {
      logger.debug("Session valid. Continueing.");
      // continue for now - next sync will check complete state
    }
  } else {
    logger.debug("No valid session found. Creating new config.");
    // we need new config
    config.update({ environmentId: c.environmentId, apiHost: c.apiHost });

    logger.debug("Syncing.");
    const syncResult = await sync();

    if (syncResult.ok !== true) {
      return err(syncResult.error);
    }

    const state = syncResult.value;

    console.log("state", state);

    config.update({ state });

    const trackActionResult = await trackAction("New Session");

    if (trackActionResult.ok !== true) return err(trackActionResult.error);
  }

  logger.debug("Add session event listeners");
  addSyncEventListener();

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
