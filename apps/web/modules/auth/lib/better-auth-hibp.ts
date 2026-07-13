import "server-only";
// `getCurrentAuthContext` reads a shared AsyncLocalStorage singleton that Better Auth populates per
// request. It MUST resolve to the same `@better-auth/core` instance `better-auth` uses, so we rely on
// the single transitively-hoisted copy rather than declaring `@better-auth/core` as a direct dep — a
// second copy would have its own (empty) ALS and silently disable the check.
import { getCurrentAuthContext } from "@better-auth/core/context";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, isAPIError } from "better-auth/api";
import { createHash } from "node:crypto";
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
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
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
            if (!authContext.path || !CHECKED_PATHS.has(authContext.path)) {
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
