/**
 * Informational notices passed between auth screens as a `?notice=` query param, then rendered as an
 * Alert on the destination page. Distinct from `?error=`, which carries failures.
 *
 * Values are matched exactly against this list and mapped to a localized string — a notice param is
 * user-controllable, so it must never be echoed into the page.
 */
export const AUTH_NOTICES = ["existing_account_invite"] as const;

export type TAuthNotice = (typeof AUTH_NOTICES)[number];

/**
 * The invited address already has a Formbricks account, so sign-up sent the user here to log in
 * instead of to a verification email that would never arrive (ENG-2091). Logging in accepts the
 * invite via the callback URL.
 */
export const EXISTING_ACCOUNT_NOTICE: TAuthNotice = "existing_account_invite";

/** Narrow an untrusted `?notice=` value to a known notice, else null. */
export const parseAuthNotice = (value: string | undefined | null): TAuthNotice | null =>
  AUTH_NOTICES.find((notice) => notice === value) ?? null;
