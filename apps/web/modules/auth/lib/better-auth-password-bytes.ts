import "server-only";
import { APIError } from "better-auth/api";
import { PASSWORD_MAX_BYTES, isPasswordWithinByteLimit } from "@formbricks/types/user";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";

/**
 * bcrypt hashes only the first 72 bytes, so a longer password is silently truncated: two passwords
 * sharing their first 72 bytes become one. `ZUserPassword` rejects such a password in the app actions;
 * this `before` hook holds the same line on Better Auth's native `/reset-password` (`/sign-up/email` and
 * `/change-password` are closed, `disabledPaths`).
 *
 * It is a path-scoped hook rather than a check in `password.hash` on purpose: Better Auth also calls
 * `hash` on sign-in for an unknown user (a timing decoy), where throwing would answer 400 instead of the
 * generic invalid-credentials error and reveal which emails exist. Verification stays unbounded so
 * existing longer hashes keep working.
 */
const BYTE_LIMITED_PATHS = new Set(["/reset-password"]);

export const passwordByteLimitBeforeHandler = (ctx: AuthHookContext): void => {
  if (!BYTE_LIMITED_PATHS.has(ctx.path)) return;

  const password = (ctx.body as { newPassword?: unknown } | undefined)?.newPassword;
  if (typeof password !== "string" || isPasswordWithinByteLimit(password)) return;

  throw new APIError("BAD_REQUEST", { message: `Password must be ${PASSWORD_MAX_BYTES} bytes or less` });
};
