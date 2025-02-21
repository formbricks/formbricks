import { CommandQueue } from "@/lib/common/command-queue";
import { Logger } from "@/lib/common/logger";
import * as Setup from "@/lib/common/setup";
import * as Action from "@/lib/survey/action";
import { checkPageUrl } from "@/lib/survey/no-code-action";
import * as Attribute from "@/lib/user/attribute";
import * as User from "@/lib/user/user";
import { type TConfigInput } from "@/types/config";

const logger = Logger.getInstance();

logger.debug("Create command queue");
const queue = new CommandQueue();

const init = async (initConfig: TConfigInput): Promise<void> => {
  queue.add(Setup.setup, false, initConfig);
  await queue.wait();
};

const setUserId = async (userId: string): Promise<void> => {
  queue.add(User.setUserId, true, userId);
  await queue.wait();
};

const setEmail = async (email: string): Promise<void> => {
  await setAttribute("email", email);
  await queue.wait();
};

const setAttribute = async (key: string, value: string): Promise<void> => {
  queue.add(Attribute.setAttributes, true, { [key]: value });
  await queue.wait();
};

export const setAttributes = async (attributes: Record<string, string>): Promise<void> => {
  queue.add(Attribute.setAttributes, true, attributes);
  await queue.wait();
};

const logout = async (): Promise<void> => {
  queue.add(User.logout, true);
  await queue.wait();
};

const track = async (
  code: string
  // properties?: TJsTrackProperties
): Promise<void> => {
  queue.add(
    Action.trackCodeAction,
    true,
    code
    // properties
  );
  await queue.wait();
};

const registerRouteChange = async (): Promise<void> => {
  queue.add(checkPageUrl, true);
  await queue.wait();
};

const formbricks = {
  init,
  setEmail,
  setAttribute,
  setAttributes,
  setUserId,
  track,
  logout,
  registerRouteChange,
};

export type TFormbricks = typeof formbricks;
export default formbricks;
