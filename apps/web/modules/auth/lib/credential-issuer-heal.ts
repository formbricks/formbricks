import "server-only";
import { createLocalAccountIssuer } from "@better-auth/core/db";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";

/** Sign-in and the reset-link request: the two doors a user with a NULL-issuer credential row is stuck at. */
const HEALED_PATHS = new Set(["/sign-in/email", "/request-password-reset"]);

/**
 * Better Auth `before` hook: give a NULL-issuer credential `Account` row its issuer before the handler
 * looks it up (ENG-3258).
 *
 * Better Auth 1.7 finds the credential row by `issuer = 'local:credential'`, so a row with a NULL issuer
 * is invisible: sign-in rejects a correct password, and a reset tries to create a second row and fails
 * on `@@unique([provider, providerAccountId])`. These rows are written by 1.6 pods that keep serving
 * during a rolling upgrade, after the ENG-2343 backfill has already run, so no migration can reach them.
 * Healing on use does, including on self-hosted instances we cannot query.
 *
 * The reset is healed at the request, not at `/reset-password`, because the request carries the email.
 * A link issued before the heal still fails, cleanly, in `resetPasswordAction`.
 *
 * The user is matched the way Better Auth matches them (lowercased, then exact). Only `issuer` changes
 * and its value follows from `provider`, so no row can move between users. Best effort: a failure is
 * logged and the request carries on exactly as it would have without this hook.
 */
export const healCredentialAccountIssuerBeforeHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (!HEALED_PATHS.has(ctx.path)) return;

  const email = (ctx.body as { email?: unknown } | undefined)?.email;
  if (typeof email !== "string" || email.length === 0) return;

  try {
    const { count } = await prisma.account.updateMany({
      where: { provider: "credential", issuer: null, user: { email: email.toLowerCase() } },
      data: { issuer: createLocalAccountIssuer("credential") },
    });

    if (count > 0) {
      logger.warn({ path: ctx.path, count }, "Healed a credential Account row with a NULL issuer");
    }
  } catch (error) {
    logger.error({ error, path: ctx.path }, "Could not heal a credential Account row with a NULL issuer");
  }
};
