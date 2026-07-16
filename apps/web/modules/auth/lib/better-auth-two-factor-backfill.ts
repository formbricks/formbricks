import "server-only";
import { isAPIError } from "better-auth/api";
import { prisma } from "@formbricks/database";
import { buildReencodedTwoFactorData } from "@/modules/auth/lib/cutover/reencode-two-factor";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";

/**
 * ENG-1824 self-heal. The custom 2FA enable flow (`modules/ee/two-factor-auth`) historically wrote the
 * secret only to the legacy `User.twoFactorSecret` column, but login verifies via Better Auth's
 * `twoFactor` plugin, which reads the `TwoFactor` table. Users who enabled 2FA before the enable-path
 * bridge landed have the legacy columns but no `TwoFactor` row, so login throws "TOTP not enabled".
 *
 * This lazily re-encodes their existing secret + backup codes into the `TwoFactor` table on their next
 * successful password sign-in — no data migration, no re-enrollment — so the `/two-factor/verify-*`
 * step that follows finds a row and succeeds. Idempotent (`TwoFactor.userId` is `@@unique`).
 *
 * Runs as a `hooks.after` on `/sign-in/email` and ONLY when that sign-in succeeded (password verified):
 * a wrong-password attempt is a handled `APIError` on `ctx.context.returned`, which we skip. This keeps
 * it from being an unauthenticated, email-guessable write. It materializes only the user's OWN existing
 * secret, returns nothing to the client, and no-ops for SSO users, non-2FA users, and users who already
 * have a `TwoFactor` row.
 */
export const twoFactorBackfillAfterHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (ctx.path !== "/sign-in/email") return;

  // Only heal after a successful password step; a failed sign-in surfaces as an APIError response.
  const returned = (ctx.context as { returned?: unknown }).returned;
  if (isAPIError(returned)) return;

  const body = ctx.body as { email?: unknown } | undefined;
  const email = typeof body?.email === "string" ? body.email.trim() : undefined;
  if (!email) return;

  // One indexed lookup on each successful password sign-in (a small, deliberate cost for this
  // temporary heal shim — it can be removed together with the legacy `User.twoFactor*` columns once
  // all enrollments are migrated). Case-insensitive so we match the same account the sign-in did,
  // whatever the stored email case; emails are unique, so this resolves to exactly one user.
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, twoFactorEnabled: true, twoFactorSecret: true, backupCodes: true },
  });
  // Only a legacy-enrolled user (2FA on + legacy secret present) can be missing a BA row.
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) return;

  const existing = await prisma.twoFactor.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) return;

  // Lazy import: this module is loaded eagerly as part of the `hooks.after` chain in auth.ts, so a
  // top-level `auth` import would be circular. We only need it once we're actually healing a row.
  const { auth } = await import("@/modules/auth/lib/auth");
  const { secretConfig } = await auth.$context;
  const twoFactorRow = await buildReencodedTwoFactorData(
    user.twoFactorSecret,
    user.backupCodes,
    secretConfig
  );
  await prisma.twoFactor.upsert({
    where: { userId: user.id },
    update: { ...twoFactorRow, verified: true },
    create: { userId: user.id, ...twoFactorRow, verified: true },
  });
};
