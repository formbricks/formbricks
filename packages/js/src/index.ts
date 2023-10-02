import type { InitConfig } from "../../types/js";
import { getApi } from "./lib/api";
import { CommandQueue } from "./lib/commandQueue";
import { ErrorHandler } from "./lib/errors";
import { trackAction } from "./lib/actions";
import { initialize } from "./lib/init";
import { Logger } from "./lib/logger";
import { checkPageUrl } from "./lib/noCodeEvents";
import { resetPerson, setPersonAttribute, setPersonUserId, getPerson, logoutPerson } from "./lib/person";

const logger = Logger.getInstance();

logger.debug("Create command queue");
const queue = new CommandQueue();

const init = async (initConfig: InitConfig) => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add(false, initialize, initConfig);
  await queue.wait();
};

const setUserId = async (userId: string | number): Promise<void> => {
  queue.add(true, setPersonUserId, userId);
  await queue.wait();
};

const setEmail = async (email: string): Promise<void> => {
  setAttribute("email", email);
  await queue.wait();
};

const setAttribute = async (key: string, value: any): Promise<void> => {
  queue.add(true, setPersonAttribute, key, value);
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

const track = async (name: string, properties: any = {}): Promise<void> => {
  queue.add<any>(true, trackAction, name, properties);
  await queue.wait();
};

const registerRouteChange = async (): Promise<void> => {
  queue.add(true, checkPageUrl);
  await queue.wait();
};

const formbricks = {
  init,
  setUserId,
  setEmail,
  setAttribute,
  track,
  logout,
  reset,
  registerRouteChange,
  getApi,
  getPerson,
};

export { formbricks as default };
