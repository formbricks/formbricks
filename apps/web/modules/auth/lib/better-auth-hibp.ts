import "server-only";
import { getCurrentAuthContext } from "@better-auth/core/context";
import { createHash } from "@better-auth/utils/hash";
import { betterFetch } from "@better-fetch/fetch";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, isAPIError } from "better-auth/api";
import { logger } from "@formbricks/logger";
import { PASSWORD_COMPROMISED_ERROR_CODE } from "@formbricks/types/errors";
import { PASSWORD_HIBP_CHECK_DISABLED } from "@/lib/constants";

/**
 * Have-I-Been-Pwned breach check on password set (ENG-1587).
 *
 * A locally-owned replacement for Better Auth's stock `haveIBeenPwned` plugin. It performs the same
 * k-anonymity range query against api.pwnedpasswords.com (only the first 5 chars of the SHA-1 leave
 * the process) but changes two behaviors the stock plugin gets wrong for self-hosting:
 *
 *  1. FAIL OPEN. The stock plugin rejects the password on ANY network error (throws 500), which would
 *     break signup + password reset entirely on air-gapped / closed-network deployments. Here a
 *     network error, timeout, or non-200 is logged and the password is ALLOWED — only a password that
 *     is *definitively found* in the breach corpus is rejected. (NIST 800-63B-4 requires checking a
 *     blocklist, not blocking when the blocklist is unreachable.)
 *  2. OPERATOR OPT-OUT. `PASSWORD_HIBP_CHECK_DISABLED=1` skips the outbound call entirely, for
 *     deployments that want zero egress attempts.
 *
 * Like the stock plugin it wraps `password.hash`, so the check runs inline on the configured set
 * paths only. Formbricks sets a password via signup (`/sign-up/email`) and reset (`/reset-password`);
 * no other path sets a password, so those are the only two we intercept.
 */

// Only the two paths that actually set a password in Formbricks (stock plugin also covers change /
// admin / phone / email-otp paths we don't use).
const CHECKED_PATHS = ["/sign-up/email", "/reset-password"];

// Tight timeout: this call blocks a login-critical flow, so we bound it well under the license
// check's 5s. On timeout we fail open (allow the password).
const HIBP_FETCH_TIMEOUT_MS = 3000;

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range";

/**
 * Returns true only when the password is confirmed present in the breach corpus. Any network / parse
 * failure returns false (fail open) after logging — never throws for infrastructure problems.
 */
const isPasswordCompromised = async (password: string): Promise<boolean> => {
  const sha1 = (await createHash("SHA-1", "hex").digest(password)).toUpperCase();
  const prefix = sha1.substring(0, 5);
  const suffix = sha1.substring(5);

  try {
    const { data, error } = await betterFetch<string>(`${HIBP_RANGE_URL}/${prefix}`, {
      // "Add-Padding" pads the response with decoy hashes so the row count can't hint at the prefix.
      headers: { "Add-Padding": "true", "User-Agent": "Formbricks Password Checker" },
      signal: AbortSignal.timeout(HIBP_FETCH_TIMEOUT_MS),
    });

    if (error || typeof data !== "string") {
      logger.warn({ status: error?.status }, "HIBP breach check unreachable; allowing password (fail open)");
      return false;
    }

    // Each line is "<SHA1_SUFFIX>:<count>". A match means the full hash is in the corpus.
    return data.split("\n").some((line) => line.split(":")[0].toUpperCase() === suffix);
  } catch (err) {
    // Timeout / DNS / connection error — fail open.
    logger.warn({ err }, "HIBP breach check failed; allowing password (fail open)");
    return false;
  }
};

/**
 * True when `error` is the breach-check rejection thrown by this plugin (a Better Auth APIError
 * carrying PASSWORD_COMPROMISED_ERROR_CODE). Sign-up / reset actions use this to re-surface it as a
 * Formbricks expected error with a stable, client-mappable code.
 */
export const isPasswordCompromisedError = (error: unknown): boolean =>
  isAPIError(error) &&
  (error.body as { code?: string } | undefined)?.code === PASSWORD_COMPROMISED_ERROR_CODE;

export const hibpBreachCheckPlugin = {
  id: "formbricks-hibp",
  init(ctx) {
    const originalHash = ctx.password.hash;
    return {
      context: {
        password: {
          ...ctx.password,
          async hash(password: string) {
            if (PASSWORD_HIBP_CHECK_DISABLED) return originalHash(password);

            const authContext = await getCurrentAuthContext();
            if (!authContext.path || !CHECKED_PATHS.includes(authContext.path)) {
              return originalHash(password);
            }

            if (await isPasswordCompromised(password)) {
              throw new APIError("BAD_REQUEST", {
                message: "The password you entered has been found in a data breach.",
                code: PASSWORD_COMPROMISED_ERROR_CODE,
              });
            }

            return originalHash(password);
          },
        },
      },
    };
  },
} satisfies BetterAuthPlugin;
