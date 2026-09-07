import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

/**
 * Repair `Account.issuer` rows that disagree with the canonical value for their provider (ENG-2555).
 *
 * The ENG-2343 backfill (20260812110000) set this correctly for every row that existed when it ran. What
 * it could not cover is rows written AFTERWARDS by SSO recovery, which used a helper that returned the
 * synthetic `local:oauth:<provider>` form for every provider — wrong for `google`, which declares its own
 * `accountIssuer` upstream (`https://accounts.google.com`).
 *
 * Better Auth 1.7 keys accounts on `(issuer, accountId)`, so such a row is invisible at sign-in: the user
 * is pushed back through verify-before-link on every attempt and never converges. This rewrites them.
 *
 * The `CASE` is byte-identical to the one in 20260812110000's `migration.sql` — including,
 * deliberately, its missing percent-encoding on the `ELSE` arm: the TS helper encodes, the SQL cannot,
 * and every provider id in use is encoding-neutral so the two coincide. Mirroring the flaw is the
 * point; "fixing" one side is how ENG-2555 happened. `apps/web/modules/ee/sso/lib/constants.test.ts`
 * parses every `CASE` copy in BOTH migrations (this file has two — `SET` and the self-excluding
 * `WHERE`) and pins them against each other, the helper, and Better Auth's own exports, so no copy can
 * drift silently.
 *
 * Safe by construction:
 * - **No-op on an empty or already-correct database.** `IS DISTINCT FROM` matches only rows that are
 *   actually wrong (and, unlike `<>`, also catches `issuer IS NULL`). Re-running changes nothing.
 * - **Cannot merge two identities.** A collision on `@@unique([issuer, providerAccountId])` would need
 *   two rows sharing a subject and mapping to one issuer. The provider→issuer map is injective and
 *   `@@unique([provider, providerAccountId])` already forbids two rows per provider+subject, so that is
 *   unreachable. If the reasoning is ever wrong the unique index aborts the migration, which is the
 *   outcome we want — no silent merge.
 * - Only the `issuer` column is touched; `userId`, `provider` and `providerAccountId` are untouched, so
 *   no row can move between users or organizations.
 */
export const repairAccountIssuer: MigrationScript = {
  type: "data",
  id: "ghqt118bfqdjs8tpzv1dvbqi",
  name: "20260821165535_repair_account_issuer",
  run: async ({ tx }) => {
    const repaired = await tx.$executeRaw`
      UPDATE "Account"
      SET "issuer" = CASE
        WHEN "provider" = 'credential' THEN 'local:credential'
        WHEN "provider" = 'google' THEN 'https://accounts.google.com'
        ELSE 'local:oauth:' || "provider"
      END
      WHERE "issuer" IS DISTINCT FROM (
        CASE
          WHEN "provider" = 'credential' THEN 'local:credential'
          WHEN "provider" = 'google' THEN 'https://accounts.google.com'
          ELSE 'local:oauth:' || "provider"
        END
      )
    `;

    if (repaired === 0) {
      logger.info("Account.issuer: no rows disagreed with the canonical value; nothing to repair");
      return;
    }

    // Worth logging loudly rather than silently: a non-zero count here means those users were stuck in
    // the SSO verify-before-link loop until this ran.
    logger.info({ repaired }, "Account.issuer: repaired rows that disagreed with the canonical value");
  },
};
