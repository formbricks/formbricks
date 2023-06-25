import type { InitConfig } from "../../../types/js";
import { addExitIntentListener, addScrollDepthListener } from "./automaticEvents";
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
import { trackEvent } from "./event";
import { Logger } from "./logger";
import { addClickEventListener, addPageUrlEventListeners, checkPageUrl } from "./noCodeEvents";
import { createPerson, resetPerson } from "./person";
import { createSession, extendOrCreateSession, extendSession, isExpired } from "./session";
import { addStylesToDom } from "./styles";
import { addWidgetContainer } from "./widget";

const config = Config.getInstance();
const logger = Logger.getInstance();

const addSessionEventListeners = (): void => {
  // add event listener to check the session every minute
  if (typeof window !== "undefined") {
    const intervalId = window.setInterval(async () => {
      await extendOrCreateSession();
    }, 1000 * 60 * 5); // check every 5 minutes
    // clear interval on page unload
    window.addEventListener("beforeunload", () => {
      clearInterval(intervalId);
    });
  }
};

export const initialize = async (
  c: InitConfig
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  if (c.logLevel) {
    logger.debug(`Setting log level to ${c.logLevel}`);
    logger.configure({ logLevel: c.logLevel });
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
    config.get().session &&
    config.get().environmentId === c.environmentId &&
    config.get().apiHost === c.apiHost
  ) {
    logger.debug("Found existing configuration. Checking session.");
    const existingSession = config.get().session;
    if (isExpired(existingSession)) {
      logger.debug("Session expired. Creating new session.");

      const createSessionResult = await createSession();

      // if create session fails, clear config and start from scratch
      if (createSessionResult.ok !== true) {
        await resetPerson();
        return await initialize(c);
      }

      const { session, settings } = createSessionResult.value;

      config.update({ session: extendSession(session), settings });

      const trackEventResult = await trackEvent("New Session");

      if (trackEventResult.ok !== true) return err(trackEventResult.error);
    } else {
      logger.debug("Session valid. Extending session.");
      config.update({ session: extendSession(existingSession) });
    }
  } else {
    logger.debug("No valid session found. Creating new config.");
    // we need new config
    config.update({ environmentId: c.environmentId, apiHost: c.apiHost });

    logger.debug("Get person, session and settings from server");
    const result = await createPerson();

    if (result.ok !== true) {
      return err(result.error);
    }

    const { person, session, settings } = result.value;

    config.update({ person, session: extendSession(session), settings });

    const trackEventResult = await trackEvent("New Session");

    if (trackEventResult.ok !== true) return err(trackEventResult.error);
  }

  logger.debug("Add session event listeners");
  addSessionEventListeners();

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
    !config.get().person ||
    !config.get().session ||
    !config.get().settings ||
    !ErrorHandler.initialized
  ) {
    return err({
      code: "not_initialized",
      message: "Formbricks not initialized. Call initialize() first.",
    });
  }

  return okVoid();
};
