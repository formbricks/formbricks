import { TJsAppConfigInput, TJsTrackProperties } from "@formbricks/types/js";
import { CommandQueue } from "../shared/commandQueue";
import { ErrorHandler } from "../shared/errors";
import { Logger } from "../shared/logger";
import { trackCodeAction } from "./lib/actions";
import { getApi } from "./lib/api";
import { setAttributeInApp } from "./lib/attributes";
import { initialize } from "./lib/initialize";
import { checkPageUrl } from "./lib/noCodeActions";
import { logoutPerson, resetPerson } from "./lib/person";

const logger = Logger.getInstance();

logger.debug("Create command queue");
const queue = new CommandQueue();

type QueuedMethod = {
  prop: string;
  args: unknown[];
};

const _initWithQueue = async (initConfig: TJsAppConfigInput, queuedMethods: QueuedMethod[]) => {
  try {
    await init(initConfig);
  } catch (err) {
    logger.error(`Failed to initialize formbricks: ${err}`);
    return;
  }

  for (const { prop, args } of queuedMethods) {
    if ((formbricks as any)[prop] === undefined || typeof (formbricks as any)[prop] !== "function") {
      logger.error(`Method ${prop} does not exist on formbricks`);
      continue;
    }

    await (formbricks as any)[prop](...args);
  }
};

const init = async (initConfig: TJsAppConfigInput) => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add(false, "app", initialize, initConfig);
  await queue.wait();
};

const setEmail = async (email: string): Promise<void> => {
  setAttribute("email", email);
  await queue.wait();
};

const setAttribute = async (key: string, value: any): Promise<void> => {
  queue.add(true, "app", setAttributeInApp, key, value);
  await queue.wait();
};

const logout = async (): Promise<void> => {
  queue.add(true, "app", logoutPerson);
  await queue.wait();
};

const reset = async (): Promise<void> => {
  queue.add(true, "app", resetPerson);
  await queue.wait();
};

const track = async (name: string, properties?: TJsTrackProperties): Promise<void> => {
  queue.add<any>(true, "app", trackCodeAction, name, properties);
  await queue.wait();
};

const registerRouteChange = async (): Promise<void> => {
  queue.add(true, "app", checkPageUrl);
  await queue.wait();
};

const formbricks = {
  init,
  setEmail,
  setAttribute,
  track,
  logout,
  reset,
  registerRouteChange,
  getApi,
  _initWithQueue,
};

export type TFormbricksApp = Omit<typeof formbricks, "_initWithQueue">;
export default formbricks as TFormbricksApp;
