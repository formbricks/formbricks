import "server-only";
import crypto from "node:crypto";
import { AuthenticationError } from "@formbricks/types/errors";
import { WEBAPP_URL } from "@/lib/constants";
import { auth, getUserLocale } from "@/modules/auth/lib/auth";
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

  // A 32-byte (256-bit) secret token: unguessable, and hex keeps it URL-safe for the callback query.
  const token = crypto.randomBytes(32).toString("hex");

  const ctx = await auth.$context;
  await ctx.internalAdapter.createVerificationValue({
    identifier: `delete-account-${token}`,
    value: userId,
    expiresAt: new Date(Date.now() + DELETE_ACCOUNT_LINK_VALIDITY_MS),
  });

  const deleteLink = `${WEBAPP_URL}/api/auth/delete-user/callback?token=${token}&callbackURL=/`;

  // Better Auth's callback user omits the locale, and the session may not carry it either, so resolve
  // it from the database (defaulting to en-US) to localize the transactional email.
  const locale = await getUserLocale(userId);

  await sendDeleteAccountConfirmationEmail({
    email,
    locale,
    deleteLink,
    linkValidityInMinutes: DELETE_ACCOUNT_LINK_VALIDITY_MINUTES,
  });
};
