/* eslint-disable import/no-default-export -- required for default export*/
import { CommandQueue, CommandType } from "@/lib/common/command-queue";
import * as Setup from "@/lib/common/setup";
import { getIsDebug } from "@/lib/common/utils";
import * as Action from "@/lib/survey/action";
import { checkPageUrl } from "@/lib/survey/no-code-action";
import * as Attribute from "@/lib/user/attribute";
import * as User from "@/lib/user/user";
import { type TConfigInput, type TLegacyConfigInput } from "@/types/config";
import { type TTrackProperties } from "@/types/survey";

const queue = CommandQueue.getInstance();

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
    queue.add(Setup.setup, CommandType.Setup, false, {
      ...setupConfig,
      // @ts-expect-error -- apiHost was in the older type
      ...(setupConfig.apiHost && { appUrl: setupConfig.apiHost as string }),
    } as unknown as TConfigInput);
  } else {
    queue.add(Setup.setup, CommandType.Setup, false, setupConfig);
  }

  // wait for setup to complete
  await queue.wait();
};

const setUserId = (userId: string): void => {
  queue.add(User.setUserId, CommandType.UserAction, true, userId);
};

const setEmail = (email: string): void => {
  queue.add(Attribute.setAttributes, CommandType.UserAction, true, { email });
};

const setAttribute = (key: string, value: string): void => {
  queue.add(Attribute.setAttributes, CommandType.UserAction, true, { [key]: value });
};

const setAttributes = (attributes: Record<string, string>): void => {
  queue.add(Attribute.setAttributes, CommandType.UserAction, true, attributes);
};

const setLanguage = (language: string): void => {
  queue.add(Attribute.setAttributes, CommandType.UserAction, true, { language });
};

const logout = (): void => {
  queue.add(User.logout, CommandType.GeneralAction);
};

/**
 * @param code - The code of the action to track
 * @param properties - Optional properties to set, like the hidden fields (deprecated, hidden fields will be removed in a future version)
 */
const track = (code: string, properties?: TTrackProperties): void => {
  queue.add(Action.trackCodeAction, CommandType.GeneralAction, true, code, properties);
};

const registerRouteChange = (): void => {
  queue.add(checkPageUrl, CommandType.GeneralAction);
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

type TFormbricks = typeof formbricks;
export type { TFormbricks };
export default formbricks;
