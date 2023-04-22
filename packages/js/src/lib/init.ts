import { InitConfig } from "@formbricks/types/js";
import { Config } from "./config";
import {
  MissingFieldError,
  MissingPersonError,
  MissingSessionError,
  NetworkError,
  NotInitializedError,
  Result,
  err,
} from "./errors";
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
): Promise<Result<void, MissingSessionError | MissingFieldError | NetworkError | MissingPersonError>> => {
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
    const result = await createPerson();

    if (result.ok !== true) {
      return err(result.error);
    }

    const { person, session, settings } = result.value;

    config.update({ person, session: extendSession(session), settings });
    trackEvent("New Session");
  } else if (config.get().session && isExpired(config.get().session)) {
    // we need new session
    const createSessionResult = await createSession();

    if (createSessionResult.ok !== true) return err(createSessionResult.error);

    const { session, settings } = createSessionResult.value;

    config.update({ session: extendSession(session), settings });

    const trackEventResult = await trackEvent("New Session");

    if (trackEventResult.ok !== true) return err(trackEventResult.error);

    return;
  } else if (!config.get().session) {
    return err({
      code: "missing_session",
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

export const checkInitialized = (): Result<void, NotInitializedError> => {
  logger.debug("Check if initialized");
  if (
    !config.get().apiHost ||
    !config.get().environmentId ||
    !config.get().person ||
    !config.get().session ||
    !config.get().settings
  ) {
    return err({
      code: "not_initialized",
      message: "Formbricks not initialized. Call initialize() first.",
    });
  }
};
