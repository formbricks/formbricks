import { InitConfig } from "@formbricks/types/js";
import { CommandQueue } from "./lib/commandQueue";
import { trackEvent } from "./lib/event";
import { checkInitialized, initialize } from "./lib/init";
import { resetPerson, setPersonAttribute, setPersonUserId } from "./lib/person";

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

const formbricks = { init, setUserId, setEmail, setAttribute, track, logout };

export default formbricks;
