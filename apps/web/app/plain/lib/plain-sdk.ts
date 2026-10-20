import { logger } from "@formbricks/logger";
import type { PlainCustomerDetails } from "./customer-details";

export interface PlainInitOptions {
  appId: string;
  hideLauncher?: boolean;
  theme?: "auto" | "light" | "dark";
  style?: {
    brandColor?: string;
    brandBackgroundColor?: string;
    launcherBackgroundColor?: string;
    launcherIconColor?: string;
  };
  customerDetails?: PlainCustomerDetails;
  customerDetailsSignature?: string;
  threadDetails?: { labelTypeIds?: string[] };
}

export interface PlainInstance {
  init: (options: PlainInitOptions) => void;
  update: (options: Partial<PlainInitOptions>) => unknown;
  /**
   * `null` is the widget's explicit logout: it drops the stored customer details from its
   * persisted session. Not in Plain's public docs (https://www.plain.com/docs/product/channels/chat-customization
   * lists no logout/reset method); read from the shipped SDK, which logs
   * "Explicitly logging out as customerDetails is null" on this path. Undocumented, and the CDN
   * script is unpinned, so callers go through `logoutPlain`, which tolerates it failing.
   */
  setCustomerDetails: (details: PlainCustomerDetails | null) => unknown;
  open: () => void;
  close: () => void;
  isInitialized: () => boolean;
}

/** Bound on how long a sign-out waits for Plain to persist the logout before navigating away. */
export const PLAIN_LOGOUT_TIMEOUT_MS = 1500;

export const getPlain = (): PlainInstance | null =>
  (globalThis as unknown as { Plain?: PlainInstance }).Plain ?? null;

/**
 * Run one Plain SDK call without letting it break the caller. Plain's methods may return a promise
 * (`setCustomerDetails` and `update` do in the current SDK), so both a synchronous throw and an
 * async rejection are caught. Only the step name is logged — never customer details.
 */
export const runPlainStep = async (step: string, call: () => unknown): Promise<void> => {
  try {
    await call();
  } catch (error) {
    logger.warn(
      { step, error: error instanceof Error ? error.message : String(error) },
      "Plain SDK call failed"
    );
  }
};

/** Where the widget persists its session (token + customer details). Read from the shipped SDK. */
export const PLAIN_SESSION_STORAGE_KEY = "plain:session";

/**
 * Drop the customer identity, close the widget, hide its launcher, and forget the session.
 *
 * The clear must settle before anything else runs: in the shipped SDK `setCustomerDetails` waits on
 * init, while `update` refreshes the session straight away from the *stored* identity. Issued
 * together, both write `plain:session` and the last one wins — often writing the previous user's
 * email and signature back. Removing the stored session last (after `update` has written) also
 * drops the session token the previous user's identity was bound to, which `setCustomerDetails(null)`
 * keeps. Each step is isolated, so a broken or changed SDK never breaks the caller (e.g. sign-out).
 */
export const logoutPlain = async (plain: PlainInstance): Promise<void> => {
  await runPlainStep("clearCustomer", () => plain.setCustomerDetails(null));
  await Promise.all([
    runPlainStep("close", () => plain.close()),
    runPlainStep("hideLauncher", () => plain.update({ hideLauncher: true })),
  ]);
  await runPlainStep("dropSession", () => globalThis.localStorage?.removeItem(PLAIN_SESSION_STORAGE_KEY));
};

/**
 * Sign-out ends in a full page load, which never unmounts `PlainChat`, while Plain keeps its
 * session in localStorage. Log the widget out first, but never hold the sign-out hostage to
 * Plain's network: give it a bounded window and move on.
 */
export const logoutPlainBeforeNavigation = async (timeoutMs = PLAIN_LOGOUT_TIMEOUT_MS): Promise<void> => {
  let isInitialized = false;
  const plain = getPlain();
  try {
    isInitialized = plain?.isInitialized() ?? false;
  } catch {
    isInitialized = false;
  }
  if (!plain || !isInitialized) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  await Promise.race([logoutPlain(plain), timeout]);
  clearTimeout(timer);
};
