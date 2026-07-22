import "server-only";
import { APIError, isAPIError } from "better-auth/api";
import { createHash } from "node:crypto";
import { logger } from "@formbricks/logger";
import { PASSWORD_COMPROMISED_ERROR_CODE } from "@formbricks/types/errors";
import { PASSWORD_HIBP_CHECK_DISABLED } from "@/lib/constants";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";

/**
 * Have-I-Been-Pwned breach check on password set (ENG-1587).
 *
 * A locally-owned alternative to Better Auth's stock `haveIBeenPwned` plugin, run as a Better Auth
 * `before` hook (see auth.ts `hooks.before`). Two behaviours differ from the stock plugin, both
 * important for self-hosting:
 *
 *  1. FAIL OPEN. The stock plugin rejects the password on ANY network error (throws 500), which would
 *     break signup + password reset entirely on air-gapped / closed-network deployments. Here a
 *     network error, timeout, or non-200 is logged and the password is ALLOWED — only a password that
 *     is *definitively found* in the breach corpus is rejected. (NIST 800-63B-4 requires checking a
 *     blocklist, not blocking when the blocklist is unreachable.)
 *  2. OPERATOR OPT-OUT. `PASSWORD_HIBP_CHECK_DISABLED=1` skips the outbound call entirely, for
 *     deployments that want zero egress attempts.
 *
 * WHY a `before` hook rather than the stock plugin's `password.hash` wrapper: on `/reset-password`,
 * Better Auth *consumes the reset token before hashing* (api/routes/password.ts). Rejecting at hash
 * time would burn the token, so a valid retry would fail with "link already used" (ENG-1587 review).
 * Running before the endpoint handler rejects a breached password without consuming the token (and
 * without creating the user on signup), and it covers the raw `/api/auth/*` endpoints as well as the
 * server actions.
 */

// The two Better Auth paths that set a password in Formbricks. Signup carries `password`; reset
// carries `newPassword`.
const CHECKED_PATHS = new Set(["/sign-up/email", "/reset-password"]);

// Tight timeout: this call blocks a login-critical flow, so we bound it well under the license
// check's 5s. On timeout we fail open (allow the password).
const HIBP_FETCH_TIMEOUT_MS = 3000;

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range";

/**
 * Returns true only when the password is confirmed present in the breach corpus. A network failure,
 * timeout, or non-OK response returns false (fail open) after logging — never throws for
 * infrastructure problems.
 */
const isPasswordCompromised = async (password: string): Promise<boolean> => {
  // SHA-1 is mandated by the HaveIBeenPwned range (k-anonymity) API — only the first 5 hex chars of
  // this digest ever leave the process, and it is NOT used for storage or authentication (bcrypt via
  // hashSecret does that). The CodeQL "insufficient computational effort" and SonarQube S4790
  // weak-hash alerts here are false positives.
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase(); // NOSONAR S4790 - see above
  const prefix = sha1.substring(0, 5);
  const suffix = sha1.substring(5);

  try {
    const res = await fetch(`${HIBP_RANGE_URL}/${prefix}`, {
      // "Add-Padding" pads the response with decoy hashes so the row count can't hint at the prefix.
      headers: { "Add-Padding": "true", "User-Agent": "Formbricks Password Checker" },
      signal: AbortSignal.timeout(HIBP_FETCH_TIMEOUT_MS),
      // Next.js instruments global fetch with its Data Cache — force every check to hit the live corpus
      // so a breach verdict is never served from a cached/stale response.
      cache: "no-store",
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "HIBP breach check unreachable; allowing password (fail open)");
      return false;
    }

    const body = await res.text();
    // Each line is "<SHA1_SUFFIX>:<count>"; trim to tolerate CRLF endings. A match means the full hash
    // is in the corpus.
    return body.split("\n").some((line) => line.trim().split(":")[0].toUpperCase() === suffix);
  } catch (err) {
    // Timeout / DNS / connection error — fail open.
    logger.warn({ err }, "HIBP breach check failed; allowing password (fail open)");
    return false;
  }
};

/**
 * Better Auth `before` hook: reject a breached password on the password-set paths before the endpoint
 * handler runs (i.e. before the reset token is consumed / the user is created). No-ops on every other
 * path and when the check is disabled.
 */
export const hibpBreachCheckBeforeHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (PASSWORD_HIBP_CHECK_DISABLED || !CHECKED_PATHS.has(ctx.path)) return;

  const body = ctx.body as { password?: unknown; newPassword?: unknown } | undefined;
  const password = body?.password ?? body?.newPassword;
  if (typeof password !== "string" || password.length === 0) return;

  if (await isPasswordCompromised(password)) {
    throw new APIError("BAD_REQUEST", {
      message: "The password you entered has been found in a data breach.",
      code: PASSWORD_COMPROMISED_ERROR_CODE,
    });
  }
};

/**
 * True when `error` is the breach-check rejection thrown by this hook (a Better Auth APIError carrying
 * PASSWORD_COMPROMISED_ERROR_CODE). Sign-up / reset actions use this to re-surface it as a Formbricks
 * expected error with a stable, client-mappable code.
 */
export const isPasswordCompromisedError = (error: unknown): boolean =>
  isAPIError(error) &&
  (error.body as { code?: string } | undefined)?.code === PASSWORD_COMPROMISED_ERROR_CODE;
