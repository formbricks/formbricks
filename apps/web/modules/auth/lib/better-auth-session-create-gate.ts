import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { prisma } from "@formbricks/database";
import { requireSsoSignInForSsoLinkedUser } from "@/modules/ee/sso/lib/sso-password-sign-in-gate";
import { rejectInactiveUser } from "./better-auth-active-user-gate";

type TSessionCreateBefore = NonNullable<
  NonNullable<NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["session"]>["create"]>["before"]
>;

/**
 * `databaseHooks.session.create.before`: the checks every new session passes, on one read of the user.
 *
 * Better Auth runs it on every session creation (credential, SSO, recovery and two-factor sign-ins) and
 * only after a password sign-in's password and email-verification checks passed, so a refusal here never
 * tells a caller without the password anything.
 *
 * 1. A deactivated user gets no session ({@link rejectInactiveUser}). First, so they are told that rather
 *    than pointed at SSO.
 * 2. An account linked to SSO signs in with SSO while one of its providers is offered
 *    ({@link requireSsoSignInForSsoLinkedUser}, ENG-2590); it only looks at password sign-ins.
 *
 * A session for a user row that is gone is left to fail on the foreign key, as before.
 */
export const gateSessionCreate: TSessionCreateBefore = async (session, context) => {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, isActive: true, identityProvider: true },
  });
  if (!user) return;

  rejectInactiveUser(user);
  await requireSsoSignInForSsoLinkedUser(user, context?.path);
};
