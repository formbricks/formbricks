import "server-only";
import crypto from "node:crypto";
import { prisma } from "@formbricks/database";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
import type { TUserLocale } from "@formbricks/types/user";
import { IS_FORMBRICKS_CLOUD, WEBAPP_URL } from "@/lib/constants";
import { FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL } from "@/modules/account/constants";
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

  // Match the credential delete path's post-deletion redirect (DeleteAccountModal): survey on
  // Formbricks Cloud, /auth/login otherwise. Better Auth's delete-user/callback only accepts
  // same-origin callbackURLs (trustedOrigins); the survey is served from the Cloud app's own origin,
  // so it passes there. (It is rejected when WEBAPP_URL differs from the survey origin — e.g. a local
  // build with the Cloud flag forced on.)
  const callbackURL = IS_FORMBRICKS_CLOUD ? FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL : "/auth/login";
  const deleteLink = `${WEBAPP_URL}/api/auth/delete-user/callback?token=${token}&callbackURL=${encodeURIComponent(callbackURL)}`;

  await sendDeleteAccountConfirmationEmail({
    email,
    locale,
    deleteLink,
    linkValidityInMinutes: DELETE_ACCOUNT_LINK_VALIDITY_MINUTES,
  });
};
