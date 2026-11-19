import "server-only";
import { Prisma } from "@formbricks/database/prisma";

/**
 * The consent rows a user's grant to an MCP client is held against: the row locks every path takes, the bound a
 * client's scopes come from, and the read the grant hooks share.
 *
 * Extracted from `oauth-grant-revocation.ts` because both halves lock consents: the hooks that follow a
 * consent change (`oauth-grant-revocation.ts`) and the revocation that ends a grant (`mcp-grant-revocation.ts`).
 * Every path that locks several takes them in `id` order and after the client's grant, so a refresh racing a
 * revoke or a narrowing waits instead of deadlocking.
 */

export type TConsentRow = {
  id: string;
  clientId: string;
  scopes: string[];
  updatedAt: Date;
  skipConsent: boolean;
};

/**
 * Which client's consent to read: by client id, or, for `update-consent`, through the id of one of its
 * consent rows, which only resolves when that row is the user's.
 */
export type TConsentTarget = { clientId: string } | { consentId: string };

/**
 * Locks the user's consent rows for the client, in `id` order, with the client's `skipConsent` flag. One
 * round trip for everything the hooks read before deciding. Every path that locks several rows (this
 * module's; upstream writes only one row at a time) takes them in that order, and after the client's
 * grant, so a refresh racing a revoke or a narrowing waits instead of deadlocking.
 */
export const lockConsents = (
  tx: Prisma.TransactionClient,
  userId: string,
  target: TConsentTarget,
  mode: "share" | "update"
): Promise<TConsentRow[]> => {
  const clientId =
    "clientId" in target
      ? Prisma.sql`${target.clientId}`
      : Prisma.sql`(
          SELECT "clientId" FROM "oauthConsent" WHERE "id" = ${target.consentId} AND "userId" = ${userId}
        )`;
  const lock = mode === "update" ? Prisma.sql`FOR UPDATE OF c` : Prisma.sql`FOR SHARE OF c`;
  return tx.$queryRaw<TConsentRow[]>`
    SELECT c."id", c."clientId", c."scopes", c."updatedAt", cl."skipConsent"
    FROM "oauthConsent" c JOIN "oauthClient" cl ON cl."clientId" = c."clientId"
    WHERE c."userId" = ${userId} AND c."clientId" = ${clientId}
    ORDER BY c."id"
    ${lock}`;
};

/**
 * The scopes a set of consent rows allows, and the row that decision rests on; `null` without a row.
 *
 * Normally one row: the provider finds the (user, client) consent and updates it. Two concurrent first
 * approvals can each insert one, though, and a later approval or `update-consent` then rewrites only one
 * of them. The bound is the most recently written row, the user's latest decision. Picked here rather
 * than by `ORDER BY`, which sorts before a waited-on row's new values come back.
 *
 * The provider stamps `updatedAt` to the second, so rows written in the same second can't be ordered by
 * it. `isLatestWrite` then names the row the caller knows was just written; without one, the bound is
 * what every tied row allows, which can only ever be narrower than the user meant. Authorized apps lists
 * a client's cap by the same rule (`authorized-clients.ts`), so Edit never offers what Save refuses.
 */
export const consentBound = <TRow extends Pick<TConsentRow, "scopes" | "updatedAt">>(
  consents: ReadonlyArray<TRow>,
  isLatestWrite?: (consent: TRow) => boolean
): { scopes: string[]; newest: TRow } | null => {
  if (consents.length === 0) return null;
  const newestAt = Math.max(...consents.map((consent) => consent.updatedAt.getTime()));
  const newest = consents.filter((consent) => consent.updatedAt.getTime() === newestAt);
  const written = isLatestWrite ? newest.find(isLatestWrite) : undefined;
  if (written) return { scopes: written.scopes, newest: written };
  const scopes = newest[0].scopes.filter((scope) =>
    newest.every((consent) => consent.scopes.includes(scope))
  );
  return { scopes, newest: newest[0] };
};

/**
 * The scopes the user has consented to for the client, or `null` without a consent. Read `FOR SHARE`,
 * so a consent delete or narrowing that is still in flight is waited on rather than read around.
 */
export const readConsentedScopes = async (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string
): Promise<string[] | null> =>
  consentBound(await lockConsents(tx, userId, { clientId }, "share"))?.scopes ?? null;
