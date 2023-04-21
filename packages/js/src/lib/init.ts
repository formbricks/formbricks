import { InitConfig } from "@formbricks/types/js";
import { Config } from "./config";
import { InitializationError, MissingFieldError, Result, err } from "./errors";
import { trackEvent } from "./event";
import { Logger } from "./logger";
import { addClickEventListener, addPageUrlEventListeners } from "./noCodeEvents";
import { createPerson } from "./person";
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
): Promise<Result<void, InitializationError | MissingFieldError>> => {
  logger.debug("Start initialize");

  if (!c.environmentId) {
    logger.debug("No environmentId provided");
    return err({
      code: "MISSING_FIELD",
      field: "environmentId",
    });
  }

  if (!c.apiHost) {
    logger.debug("No apiHost provided");

    return err({
      code: "MISSING_FIELD",
      field: "apiHost",
    });
  }

  if (c.logLevel) {
    logger.debug(`Setting log level to ${c.logLevel}`);
    logger.configure({ logLevel: c.logLevel });
  }

  logger.debug("Adding widget container to DOM");
  addWidgetContainer();

  logger.debug("Adding styles to DOM");
  addStylesToDom();

  if (!config || config.get().environmentId !== c.environmentId || config.get().apiHost !== c.apiHost) {
    logger.debug("New config required");
    // we need new config
    config.update({ environmentId: c.environmentId, apiHost: c.apiHost });

    logger.debug("Get person, session and settings from server");
    const { person, session, settings } = await createPerson();
    config.update({ person, session: extendSession(session), settings });
    trackEvent("New Session");
  } else if (config.get().session && isExpired(config.get().session)) {
    // we need new session
    const { session, settings } = await createSession();
    config.update({ session: extendSession(session), settings });
    trackEvent("New Session");
  } else if (!config.get().session) {
    return err({
      code: "INITIALIZATION_ERROR",
      message: "No session found",
    });
  }

  logger.debug("Add session event listeners");
  addSessionEventListeners();

  logger.debug("Add page url event listeners");
  addPageUrlEventListeners();

  logger.debug("Add click event listeners");
  addClickEventListener();

  logger.debug("Initialized");
};

export const checkInitialized = (): void => {
  logger.debug("Check if initialized");
  if (
    !config.get().apiHost ||
    !config.get().environmentId ||
    !config.get().person ||
    !config.get().session ||
    !config.get().settings
  ) {
    throw Error("Formbricks: Formbricks not initialized. Call initialize() first.");
  }
};
