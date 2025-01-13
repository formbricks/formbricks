import { type TJsConfigInput } from "@formbricks/types/js";
import { ErrorHandler } from "../../../js-core/src/lib/errors";
import { Logger } from "../../../js-core/src/lib/logger";
import { trackCodeAction } from "./actions";
import { setAttributesInApp } from "./attributes";
import { CommandQueue } from "./command-queue";
import { initialize } from "./initialize";
import { logoutPerson, setUserIdInApp } from "./person";

const logger = Logger.getInstance();
logger.debug("Create command queue");
const queue = new CommandQueue();

export const init = async (initConfig: TJsConfigInput): Promise<void> => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add(initialize, false, initConfig);
  await queue.wait();
};

export const track = async (name: string, properties = {}): Promise<void> => {
  queue.add<any>(trackCodeAction, true, name, properties);
  await queue.wait();
};

export const setUserId = async (userId: string): Promise<void> => {
  queue.add(setUserIdInApp, true, userId);
  await queue.wait();
};

export const setAttribute = async (key: string, value: string): Promise<void> => {
  queue.add(setAttributesInApp, true, { [key]: value });
  await queue.wait();
};

export const setAttributes = async (attributes: Record<string, string>): Promise<void> => {
  queue.add(setAttributesInApp, true, attributes);
  await queue.wait();
};

export const logout = async (): Promise<void> => {
  queue.add(logoutPerson, true);
  await queue.wait();
};
