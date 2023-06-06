import type { InitConfig } from "../../types/js";
import { getApi } from "./lib/api";
import { CommandQueue } from "./lib/commandQueue";
import { ErrorHandler } from "./lib/errors";
import { trackEvent } from "./lib/event";
import { initialize } from "./lib/init";
import { Logger } from "./lib/logger";
import { checkPageUrl } from "./lib/noCodeEvents";
import { resetPerson, setPersonAttribute, setPersonUserId, getPerson } from "./lib/person";
import { refreshSettings } from "./lib/settings";

export type { EnvironmentId, KeyValueData, PersonId, ResponseId, SurveyId } from "@formbricks/api";

const logger = Logger.getInstance();

logger.debug("Create command queue");
const queue = new CommandQueue();

const init = async (initConfig: InitConfig) => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add(false, initialize, initConfig);
  await queue.wait();
};

const setUserId = async (userId: string): Promise<void> => {
  queue.add(true, setPersonUserId, userId);
  await queue.wait();
};

const setEmail = async (email: string): Promise<void> => {
  setAttribute("email", email);
  await queue.wait();
};

const setAttribute = async (key: string, value: string): Promise<void> => {
  queue.add(true, setPersonAttribute, key, value);
  await queue.wait();
};

const logout = async (): Promise<void> => {
  queue.add(true, resetPerson);
  await queue.wait();
};

const track = async (eventName: string, properties: any = {}): Promise<void> => {
  queue.add(true, trackEvent, eventName, properties);
  await queue.wait();
};

const refresh = async (): Promise<void> => {
  queue.add(true, refreshSettings);
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
  refresh,
  registerRouteChange,
  getApi,
  getPerson,
};

export { formbricks as default };
