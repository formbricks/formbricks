import { InitConfig } from "@formbricks/types/js";
import { CommandQueue } from "./lib/commandQueue";
import { trackEvent } from "./lib/event";
import { checkInitialized, initialize } from "./lib/init";
import { checkPageUrl } from "./lib/noCodeEvents";
import { resetPerson, setPersonAttribute, setPersonUserId } from "./lib/person";
import { refreshSettings } from "./lib/settings";

const queue = new CommandQueue();

const init = (initConfig: InitConfig) => {
  queue.add(async () => {
    initialize(initConfig);
  });
};

const setUserId = (userId: string): void => {
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
  queue.add(async () => {
    checkInitialized();
    await trackEvent(eventName, properties);
  });
};

const refresh = (): void => {
  queue.add(async () => {
    checkInitialized();
    await refreshSettings();
  });
};

const registerRouteChange = (): void => {
  queue.add(async () => {
    checkInitialized();
    checkPageUrl();
  });
};

const formbricks = { init, setUserId, setEmail, setAttribute, track, logout, refresh, registerRouteChange };

export default formbricks;
