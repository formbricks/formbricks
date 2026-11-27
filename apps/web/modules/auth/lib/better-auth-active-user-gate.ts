import "server-only";
import { APIError } from "better-auth/api";

/**
 * Session-creation check (ENG-1054), run by `gateSessionCreate` — preserves the NextAuth
 * `user.isActive === false` sign-in rejection (authOptions.ts credential + email-verification paths)
 * that Better Auth otherwise drops.
 *
 * The credential-account backfill migrates EVERY user with `User.password IS NOT NULL`, deactivated
 * ones included, and Better Auth's email/password (and SSO / recovery) sign-in would mint a session
 * from valid credentials with no isActive check. Session creation is the single choke point covering
 * credential, SSO, and the recovery magic-link, and this throws BEFORE the `Session` row is written, so
 * a deactivated user can neither sign in nor leave an orphaned session behind. Session *refresh* goes
 * through `updateSession` (not create), so live sessions of still-active users are unaffected. The
 * message mirrors authOptions for parity.
 */
export const rejectInactiveUser = (user: { isActive: boolean }): void => {
  if (!user.isActive) {
    throw new APIError("FORBIDDEN", {
      message: "Your account is currently inactive. Please contact the organization admin.",
    });
  }
};
