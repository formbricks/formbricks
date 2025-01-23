import { type TConfigInput } from "../types/config";
import * as Actions from "./actions";
import * as Attributes from "./attributes";
import { CommandQueue } from "./command-queue";
import * as Initialize from "./initialize";
import * as Language from "./language";
import { Logger } from "./logger";
import * as User from "./user";

const logger = Logger.getInstance();
logger.debug("Create command queue");
const queue = new CommandQueue();

export const init = async (initConfig: Pick<TConfigInput, "apiHost" | "environmentId">): Promise<void> => {
  queue.add(Initialize.init, false, initConfig);
  await queue.wait();
};

export const track = async (name: string): Promise<void> => {
  queue.add(Actions.track, true, name);
  await queue.wait();
};

export const setUserId = async (userId: string): Promise<void> => {
  queue.add(User.setUserId, true, userId);
  await queue.wait();
};

export const setAttribute = async (key: string, value: string): Promise<void> => {
  queue.add(Attributes.setAttributes, true, { [key]: value });
  await queue.wait();
};

export const setAttributes = async (attributes: Record<string, string>): Promise<void> => {
  queue.add(Attributes.setAttributes, true, attributes);
  await queue.wait();
};

export const setLanguage = async (language: string): Promise<void> => {
  queue.add(Language.setLanguage, true, language);
  await queue.wait();
};

export const logout = async (): Promise<void> => {
  queue.add(User.logout, true);
  await queue.wait();
};
