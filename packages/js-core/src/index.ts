import { CommandQueue, CommandType } from "@/lib/common/command-queue";
import * as Setup from "@/lib/common/setup";
import { getIsDebug } from "@/lib/common/utils";
import * as Action from "@/lib/survey/action";
import { SurveyLifecycleEmitter } from "@/lib/survey/lifecycle";
import { checkPageUrl } from "@/lib/survey/no-code-action";
import * as Attribute from "@/lib/user/attribute";
import * as User from "@/lib/user/user";
import { type TConfigInput, type TLegacyConfigInput } from "@/types/config";
import {
  type TSurveyLifecycleEventHandler,
  type TSurveyLifecycleEventType,
  type TTrackProperties,
} from "@/types/survey";

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
      console.warn("🧱 Formbricks - Warning: Using legacy init");
    }
    await queue.add(Setup.setup, CommandType.Setup, false, {
      ...setupConfig,
      // @ts-expect-error -- apiHost was in the older type
      ...(setupConfig.apiHost && { appUrl: setupConfig.apiHost as string }),
    });
  } else {
    await queue.add(Setup.setup, CommandType.Setup, false, setupConfig);
  }

  // wait for setup to complete
  await queue.wait();

  // Schedule checkPageUrl to run in the next event loop iteration.
  // This ensures that any user actions (like setUserId) called synchronously after setup()
  // will be queued BEFORE the page view actions are processed.
  setTimeout(() => {
    void checkPageUrl();
  }, 0);
};

const setUserId = async (userId: string): Promise<void> => {
  await queue.add(User.setUserId, CommandType.UserAction, true, userId);
};

const setEmail = async (email: string): Promise<void> => {
  await queue.add(Attribute.setAttributes, CommandType.UserAction, true, { email });
};

const setAttribute = async (key: string, value: string): Promise<void> => {
  await queue.add(Attribute.setAttributes, CommandType.UserAction, true, { [key]: value });
};

const setAttributes = async (attributes: Record<string, string>): Promise<void> => {
  await queue.add(Attribute.setAttributes, CommandType.UserAction, true, attributes);
};

const setLanguage = async (language: string): Promise<void> => {
  await queue.add(Attribute.setAttributes, CommandType.UserAction, true, { language });
};

const logout = async (): Promise<void> => {
  await queue.add(User.logout, CommandType.GeneralAction);
};

/**
 * @param code - The code of the action to track
 * @param properties - Optional properties to set, like the hidden fields (deprecated, hidden fields will be removed in a future version)
 */
const track = async (code: string, properties?: TTrackProperties): Promise<void> => {
  await queue.add(Action.trackCodeAction, CommandType.GeneralAction, true, code, properties);
};

const registerRouteChange = async (): Promise<void> => {
  await queue.add(checkPageUrl, CommandType.GeneralAction);
};

/**
 * Subscribe to a survey lifecycle event.
 *
 * The host application is notified when a survey is actually shown ("displayed"), answered
 * ("responded") and dismissed or finished ("closed"), so it can drive its own logic — frequency
 * capping, analytics — off what the SDK really did rather than off the `track()` calls it made.
 *
 * Subscriptions are independent of setup(): registering before or after setup() both work, and a
 * handler stays registered across logout() until it is removed.
 *
 * @param eventType - "displayed" | "responded" | "closed"
 * @param handler - Called with the event type and the survey it concerns
 * @returns A function that removes this subscription. `off()` with the same arguments does the same.
 */
const on = (eventType: TSurveyLifecycleEventType, handler: TSurveyLifecycleEventHandler): (() => void) =>
  SurveyLifecycleEmitter.getInstance().on(eventType, handler);

/**
 * Remove a survey lifecycle subscription registered with on().
 *
 * @param eventType - The event type the handler was registered for
 * @param handler - The same function reference that was passed to on()
 */
const off = (eventType: TSurveyLifecycleEventType, handler: TSurveyLifecycleEventHandler): void => {
  SurveyLifecycleEmitter.getInstance().off(eventType, handler);
};

/**
 * Set the CSP nonce for inline styles
 * @param nonce - The CSP nonce value (without 'nonce-' prefix), or undefined to clear
 */
const setNonce = (nonce: string | undefined): void => {
  // Store nonce on window for access when surveys package loads
  globalThis.window.__formbricksNonce = nonce;

  // Set nonce in surveys package if it's already loaded

  globalThis.window.formbricksSurveys?.setNonce?.(nonce);
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
  setNonce,
  on,
  off,
};

// Explicitly assign to globalThis so the wrapper SDK (@formbricks/js) can
// find us even when the UMD environment detection is fooled by a leaked
// `exports` or `module` global on the page (e.g. from another UMD bundle,
// a tag manager, or a browser extension).  This runs inside the UMD factory,
// so it executes regardless of which branch the wrapper picks.
(globalThis as unknown as Record<string, unknown>).formbricks = formbricks;

type TFormbricks = typeof formbricks;
export type { TFormbricks };
export type {
  TSurveyLifecycleEvent,
  TSurveyLifecycleEventHandler,
  TSurveyLifecycleEventType,
} from "@/types/survey";
export default formbricks;
