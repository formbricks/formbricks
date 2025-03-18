/* eslint-disable import/no-default-export -- required for default export*/
import { CommandQueue } from "@/lib/common/command-queue";
import * as Setup from "@/lib/common/setup";
import { getIsDebug } from "@/lib/common/utils";
import * as Action from "@/lib/survey/action";
import { checkPageUrl } from "@/lib/survey/no-code-action";
import * as Attribute from "@/lib/user/attribute";
import * as User from "@/lib/user/user";
import { type TConfigInput, type TLegacyConfigInput } from "@/types/config";

const queue = new CommandQueue();

const setup = async (setupConfig: TConfigInput): Promise<void> => {
  // If the initConfig has a userId or attributes, we need to use the legacy init

  if (
    // @ts-expect-error -- userId and attributes were in the older type
    setupConfig.userId ||
    // @ts-expect-error -- attributes were in the older type
    setupConfig.attributes ||
    // @ts-expect-error -- apiHost was in the older type
    setupConfig.apiHost
  ) {
    const isDebug = getIsDebug();
    if (isDebug) {
      // eslint-disable-next-line no-console -- legacy init
      console.warn("🧱 Formbricks - Warning: Using legacy init");
    }
    queue.add(Setup.setup, false, {
      ...setupConfig,
      // @ts-expect-error -- apiHost was in the older type
      ...(setupConfig.apiHost && { appUrl: setupConfig.apiHost as string }),
    } as unknown as TConfigInput);
  } else {
    queue.add(Setup.setup, false, setupConfig);
    await queue.wait();
  }
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

const setAttributes = async (attributes: Record<string, string>): Promise<void> => {
  queue.add(Attribute.setAttributes, true, attributes);
  await queue.wait();
};

const setLanguage = async (language: string): Promise<void> => {
  queue.add(Attribute.setAttributes, true, { language });
  await queue.wait();
};

const logout = async (): Promise<void> => {
  queue.add(User.logout, true);
  await queue.wait();
};

const track = async (code: string): Promise<void> => {
  queue.add(Action.trackCodeAction, true, code);
  await queue.wait();
};

const registerRouteChange = async (): Promise<void> => {
  queue.add(checkPageUrl, true);
  await queue.wait();
};

const formbricks = {
  /** @deprecated Use setup() instead. This method will be removed in a future version */
  init: (initConfig: TLegacyConfigInput) => setup(initConfig as unknown as TConfigInput),
  setup,
  setEmail,
  setAttribute,
  setAttributes,
  setLanguage,
  setUserId,
  track,
  logout,
  registerRouteChange,
};

export type TFormbricks = typeof formbricks;
export default formbricks;
