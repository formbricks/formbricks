import { InitConfig } from "@formbricks/types/js";
import { addStylesToDom } from "./styles";
import Config from "./config";
import { Logger } from "./logger";
import { createPerson } from "./person";
import { createSession, extendOrCreateSession, extendSession, isExpired } from "./session";
import { trackEvent } from "./event";
import { checkPageUrl } from "./noCodeEvents";

const config = Config.get();
const logger = Logger.getInstance();

const addSessionEventListeners = (): void => {
  // add event listener to check the session every minute
  if (typeof window !== "undefined") {
    const intervalId = window.setInterval(async () => {
      await extendOrCreateSession();
    }, 60000);
    // clear interval on page unload
    window.addEventListener("beforeunload", () => {
      clearInterval(intervalId);
    });
  }
};

export const initialize = async (c: InitConfig): Promise<void> => {
  if (c.logLevel) {
    logger.configure({ logLevel: c.logLevel });
  }
  if (!config || config.environmentId !== c.environmentId || config.apiHost !== c.apiHost) {
    // we need new config
    Config.update({ environmentId: c.environmentId, apiHost: c.apiHost });
    // get person, session and settings from server
    const { person, session, settings } = await createPerson();
    Config.update({ person, session: extendSession(session), settings });
  }
  if (isExpired(config.session)) {
    // we need new session
    const { session, settings } = await createSession();
    Config.update({ session: extendSession(session), settings });
  }
  addStylesToDom();
  addSessionEventListeners();
  trackEvent("New Session");
  checkPageUrl();
};

export const checkInitialized = (): void => {
  if (!config.apiHost || !config.environmentId || !config.person || !config.session || !config.settings) {
    throw Error("Formbricks: Formbricks not initialized. Call initialize() first.");
  }
};
