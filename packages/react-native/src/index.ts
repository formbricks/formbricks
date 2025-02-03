import { Formbricks } from "@/components/formbricks";
import { CommandQueue } from "@/lib/common/command-queue";
import { Logger } from "@/lib/common/logger";
import * as Actions from "@/lib/survey/action";
import * as Attributes from "@/lib/user/attribute";
import * as User from "@/lib/user/user";

const logger = Logger.getInstance();
logger.debug("Create command queue");
const queue = new CommandQueue();

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
  queue.add(Attributes.setAttributes, true, { language });
  await queue.wait();
};

export const logout = async (): Promise<void> => {
  queue.add(User.logout, true);
  await queue.wait();
};

export default Formbricks;
