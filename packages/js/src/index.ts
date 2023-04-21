import { InitConfig } from "@formbricks/types/js";
import { CommandQueue } from "./lib/commandQueue";
import { trackEvent } from "./lib/event";
import { checkInitialized, initialize } from "./lib/init";
import { Logger } from "./lib/logger";
import { checkPageUrl } from "./lib/noCodeEvents";
import { resetPerson, setPersonAttribute, setPersonUserId } from "./lib/person";
import { refreshSettings } from "./lib/settings";

const logger = Logger.getInstance();

logger.debug("Create command queue");
const queue = new CommandQueue();

const init = (initConfig: InitConfig) => {
  logger.debug("Add init command to queue");
  queue.add(async () => {
    initialize(initConfig);
  });
};

const setUserId = (userId: string): void => {
  logger.debug("Add setUserId command to queue");
  queue.add(async () => {
    checkInitialized();
    await setPersonUserId(userId);
  });
};

const setEmail = (email: string): void => {
  setAttribute("email", email);
};

const setAttribute = (key: string, value: string): void => {
  queue.add(async () => {
    checkInitialized();
    await setPersonAttribute(key, value);
  });
};

const logout = (): void => {
  queue.add(async () => {
    checkInitialized();
    await resetPerson();
  });
};

const track = (eventName: string, properties: any = {}): void => {
  logger.debug("Add track command to queue");
  queue.add(async () => {
    checkInitialized();
    await trackEvent(eventName, properties);
  });
};

const refresh = (): void => {
  logger.debug("Add refresh command to queue");
  queue.add(async () => {
    checkInitialized();
    await refreshSettings();
  });
};

const registerRouteChange = (): void => {
  logger.debug("Add registerRouteChange command to queue");
  queue.add(async () => {
    checkInitialized();
    checkPageUrl();
  });
};

const formbricks = { init, setUserId, setEmail, setAttribute, track, logout, refresh, registerRouteChange };

export default formbricks;
