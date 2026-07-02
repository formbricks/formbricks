import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { prisma } from "@formbricks/database";

type SessionDatabaseHook = NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["session"]>;

/**
 * `databaseHooks.session.create.before` gate (ENG-1054) — preserves the NextAuth
 * `user.isActive === false` sign-in rejection (authOptions.ts credential + email-verification paths)
 * that Better Auth otherwise drops.
 *
 * The credential-account backfill migrates EVERY user with `User.password IS NOT NULL`, deactivated
 * ones included, and Better Auth's email/password (and SSO / recovery) sign-in would mint a session
 * from valid credentials with no isActive check. This runs on every session creation — the single
 * choke point covering credential, SSO, and the recovery magic-link — and throws BEFORE the `Session`
 * row is written, so a deactivated user can neither sign in nor leave an orphaned session behind.
 * Session *refresh* goes through `updateSession` (not create), so live sessions of still-active users
 * are unaffected. The message mirrors authOptions for parity.
 */
export const rejectInactiveUserOnSessionCreate: NonNullable<
  NonNullable<SessionDatabaseHook["create"]>["before"]
> = async (session) => {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isActive: true },
  });
  if (user?.isActive === false) {
    throw new APIError("FORBIDDEN", {
      message: "Your account is currently inactive. Please contact the organization admin.",
    });
  }
};
