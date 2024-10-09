import { TJsConfigInput, TJsTrackProperties } from "@formbricks/types/js";
import { trackCodeAction } from "./lib/actions";
import { getApi } from "./lib/api";
import { setAttributeInApp } from "./lib/attributes";
import { CommandQueue } from "./lib/commandQueue";
import { ErrorHandler } from "./lib/errors";
import { initialize } from "./lib/initialize";
import { Logger } from "./lib/logger";
import { checkPageUrl } from "./lib/noCodeActions";
import { logoutPerson, resetPerson } from "./lib/person";

const logger = Logger.getInstance();

logger.debug("Create command queue");
const queue = new CommandQueue();

const init = async (initConfig: TJsConfigInput) => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add(false, initialize, initConfig);
  await queue.wait();
};

const setEmail = async (email: string): Promise<void> => {
  setAttribute("email", email);
  await queue.wait();
};

const setAttribute = async (key: string, value: any): Promise<void> => {
  queue.add(true, setAttributeInApp, key, value);
  await queue.wait();
};

const logout = async (): Promise<void> => {
  queue.add(true, logoutPerson);
  await queue.wait();
};

const reset = async (): Promise<void> => {
  queue.add(true, resetPerson);
  await queue.wait();
};

const track = async (name: string, properties?: TJsTrackProperties): Promise<void> => {
  queue.add<any>(true, trackCodeAction, name, properties);
  await queue.wait();
};

const registerRouteChange = async (): Promise<void> => {
  queue.add(true, checkPageUrl);
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
};

export type TFormbricksApp = typeof formbricks;
export default formbricks as TFormbricksApp;
