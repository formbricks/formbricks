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

const init = (initConfig: InitConfig) => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add(false, initialize, initConfig);
};

const setUserId = (userId: string): void => {
  queue.add(true, setPersonUserId, userId);
};

const setEmail = (email: string): void => {
  setAttribute("email", email);
};

const setAttribute = (key: string, value: string): void => {
  queue.add(true, setPersonAttribute, key, value);
};

const logout = (): void => {
  queue.add(true, resetPerson);
};

const track = (eventName: string, properties: any = {}): void => {
  queue.add(true, trackEvent, eventName, properties);
};

const refresh = (): void => {
  queue.add(true, refreshSettings);
};

const registerRouteChange = (): void => {
  queue.add(true, checkPageUrl);
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
