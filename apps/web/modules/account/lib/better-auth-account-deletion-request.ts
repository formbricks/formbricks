import "server-only";
import crypto from "node:crypto";
import { prisma } from "@formbricks/database";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
import type { TUserLocale } from "@formbricks/types/user";
import { WEBAPP_URL } from "@/lib/constants";
import { ACCOUNT_DELETED_PATH } from "@/modules/account/constants";
import { requiresPasswordConfirmationForAccountDeletion } from "@/modules/account/lib/account-deletion-auth";
import { auth } from "@/modules/auth/lib/auth";
import { getSession } from "@/modules/auth/lib/session";
import { sendDeleteAccountConfirmationEmail } from "@/modules/email";

/**
 * SSO account-deletion email-link request (ENG-1054, design doc §14).
 *
 * Credential users confirm deletion with their password (Better Auth verifies it before the native
 * delete runs). SSO users have no password, so confirmation moves to the inbox: this action mints a
 * `delete-account-<token>` verification value carrying the requester's user id — exactly the shape
 * Better Auth's native `GET /api/auth/delete-user/callback` consumes (it deletes only when the stored
 * value === the session user's id) — and emails the callback link.
 *
 * The global `sendDeleteAccountVerification` is intentionally NOT configured in auth.ts (it would
 * email credential deletions too), so the verification value is minted manually here. Server-only; the
 * DeleteAccountModal calls this for SSO users.
 */

// Matches the manual mint in better-auth-account-deletion.integration.test.ts: a 1-hour window.
const DELETE_ACCOUNT_LINK_VALIDITY_MS = 60 * 60 * 1000;
const DELETE_ACCOUNT_LINK_VALIDITY_MINUTES = DELETE_ACCOUNT_LINK_VALIDITY_MS / (60 * 1000);

export const requestSsoAccountDeletionEmail = async (): Promise<void> => {
  const session = await getSession();

  if (!session?.user?.id || !session.user.email) {
    throw new AuthenticationError("Not authenticated");
  }

  const userId = session.user.id;
  const email = session.user.email;

  // Resolve the account type + locale up front (the session/BA-callback user carries neither reliably).
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { identityProvider: true, locale: true },
  });
  if (!dbUser) {
    throw new AuthenticationError("Not authenticated");
  }

  // The SSO email-link path is only for password-less SSO users. Credential users (identityProvider
  // "email") must confirm deletion with their password via Better Auth's native delete-user flow.
  // Enforce that here, server-side: this runs behind a directly-callable server action, so the modal's
  // `requiresPasswordConfirmation` UI gating is not a security boundary. Reject before minting a token.
  if (requiresPasswordConfirmationForAccountDeletion(dbUser)) {
    throw new AuthorizationError("Password confirmation is required to delete this account.");
  }

  const locale = (dbUser.locale ?? "en-US") as TUserLocale;

  // A 32-byte (256-bit) secret token: unguessable, and hex keeps it URL-safe for the callback query.
  const token = crypto.randomBytes(32).toString("hex");

  const ctx = await auth.$context;
  await ctx.internalAdapter.createVerificationValue({
    identifier: `delete-account-${token}`,
    value: userId,
    expiresAt: new Date(Date.now() + DELETE_ACCOUNT_LINK_VALIDITY_MS),
  });

  // The callbackURL must be RELATIVE, and must not depend on the deployment. Better Auth runs
  // `originCheck` on the callback GET before it looks at the token, accepting only `trustedOrigins`
  // (BETTER_AUTH_URL / NEXTAUTH_URL) or a relative path — so an absolute, deployment-specific URL here
  // answers INVALID_CALLBACK_URL and the account is never deleted on any host but the one it names.
  // Sending the Cloud offboarding survey URL from here did exactly that everywhere except production
  // Cloud (ENG-3260). The post-deletion page picks the final destination in the browser instead, which
  // is what the credential path in DeleteAccountModal has always done.
  const deleteLink = `${WEBAPP_URL}/api/auth/delete-user/callback?token=${token}&callbackURL=${encodeURIComponent(ACCOUNT_DELETED_PATH)}`;

  await sendDeleteAccountConfirmationEmail({
    email,
    locale,
    deleteLink,
    linkValidityInMinutes: DELETE_ACCOUNT_LINK_VALIDITY_MINUTES,
  });
};
