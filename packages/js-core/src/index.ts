/* eslint-disable import/no-default-export -- We need default exports for the js sdk */
import { type TJsConfigInput, type TJsTrackProperties } from "@formbricks/types/js";
import { trackCodeAction } from "./lib/actions";
import { getApi } from "./lib/api";
import { setAttributeInApp } from "./lib/attributes";
import { CommandQueue } from "./lib/command-queue";
import { ErrorHandler } from "./lib/errors";
import { initialize } from "./lib/initialize";
import { Logger } from "./lib/logger";
import { checkPageUrl } from "./lib/no-code-actions";
import { logoutPerson, resetPerson } from "./lib/person";

const logger = Logger.getInstance();

logger.debug("Create command queue");
const queue = new CommandQueue();

const init = async (initConfig: TJsConfigInput): Promise<void> => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add(false, initialize, initConfig);
  await queue.wait();
};

const setEmail = async (email: string): Promise<void> => {
  await setAttribute("email", email);
  await queue.wait();
};

const setAttribute = async (key: string, value: string): Promise<void> => {
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

const track = async (code: string, properties?: TJsTrackProperties): Promise<void> => {
  queue.add(true, trackCodeAction, code, properties);
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

export type TFormbricks = typeof formbricks;
export default formbricks;
