import { InitConfig } from "@formbricks/types/js";
import { addStylesToDom } from "./styles";
import { Config } from "./config";
import { Logger } from "./logger";
import { createPerson } from "./person";
import { createSession, extendOrCreateSession, extendSession, isExpired } from "./session";
import { trackEvent } from "./event";
import { addPageUrlEventListeners, checkPageUrl } from "./noCodeEvents";
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

export const initialize = async (c: InitConfig): Promise<void> => {
  if (!c.environmentId) {
    throw Error("Formbricks: environmentId is required");
  }
  if (!c.apiHost) {
    throw Error("Formbricks: apiHost is required");
  }
  if (c.logLevel) {
    logger.configure({ logLevel: c.logLevel });
  }
  addWidgetContainer();
  addStylesToDom();
  if (!config || config.get().environmentId !== c.environmentId || config.get().apiHost !== c.apiHost) {
    // we need new config
    config.update({ environmentId: c.environmentId, apiHost: c.apiHost });
    // get person, session and settings from server
    const { person, session, settings } = await createPerson();
    config.update({ person, session: extendSession(session), settings });
    trackEvent("New Session");
  }
  if (isExpired(config.get().session)) {
    // we need new session
    const { session, settings } = await createSession();
    config.update({ session: extendSession(session), settings });
    trackEvent("New Session");
  }
  addSessionEventListeners();
  addPageUrlEventListeners();
};

export const checkInitialized = (): void => {
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
