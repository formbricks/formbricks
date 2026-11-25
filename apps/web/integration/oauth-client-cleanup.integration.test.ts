import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { createUser } from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";
import {
  ANONYMOUS_OAUTH_CLIENT_RETENTION_MS,
  deleteStaleAnonymousOauthClients,
} from "@/modules/auth/lib/oauth-client-cleanup";

/**
 * ENG-7314 against real Postgres: the relation filters and the cascade are what the job rests on, and
 * the unit test can only show the query shape. What matters here is what survives: a client someone
 * consented to, one with a live token, a client a user registered while signed in, and a young one.
 */
const NOW = new Date("2026-11-16T12:00:00.000Z");
const OLD = new Date(NOW.getTime() - ANONYMOUS_OAUTH_CLIENT_RETENTION_MS - 60_000);
const YOUNG = new Date(NOW.getTime() - 60_000);
const LATER = new Date(NOW.getTime() + 60 * 60_000);
const EARLIER = new Date(NOW.getTime() - 60 * 60_000);

let seq = 0;
const seedClient = async (
  createdAt: Date | null,
  extra: { userId?: string; skipConsent?: boolean } = {}
): Promise<string> => {
  seq += 1;
  const clientId = `eng7314-client-${seq}`;
  await prisma.oauthClient.create({
    data: { clientId, redirectUris: ["http://127.0.0.1:33418/callback"], scopes: [], createdAt, ...extra },
  });
  return clientId;
};

const exists = async (clientId: string): Promise<boolean> =>
  (await prisma.oauthClient.count({ where: { clientId } })) === 1;

const seedToken = (clientId: string, kind: "access" | "refresh", expiresAt: Date, revoked: Date | null) => {
  const data = {
    token: `t-${seq}-${kind}-${expiresAt.getTime()}-${revoked ? "r" : "l"}`,
    clientId,
    expiresAt,
    createdAt: OLD,
    revoked,
    scopes: [],
  };
  return kind === "access"
    ? prisma.oauthAccessToken.create({ data })
    : prisma.oauthRefreshToken.create({ data: { ...data, userId: userIdRef.id } });
};
const userIdRef = { id: "" };

describe("deleteStaleAnonymousOauthClients (ENG-7314)", () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.oauthClient.deleteMany();
    await createUser(`cleanup-${Date.now()}@example.com`, "Passw0rd!Passw0rd", "Cleanup User");
    userIdRef.id = (await prisma.user.findFirstOrThrow({ select: { id: true } })).id;
  });

  test("deletes only old, anonymous clients with no consent and no live token", async () => {
    const stale = await seedClient(OLD);
    const young = await seedClient(YOUNG);
    const unknownAge = await seedClient(null);
    const owned = await seedClient(OLD, { userId: userIdRef.id });
    const skipsConsent = await seedClient(OLD, { skipConsent: true });
    const consented = await seedClient(OLD);
    await prisma.oauthConsent.create({
      data: { clientId: consented, userId: userIdRef.id, scopes: [], createdAt: OLD, updatedAt: OLD },
    });
    const liveAccess = await seedClient(OLD);
    await seedToken(liveAccess, "access", LATER, null);
    const liveRefresh = await seedClient(OLD);
    await seedToken(liveRefresh, "refresh", LATER, null);
    const deadTokens = await seedClient(OLD);
    await seedToken(deadTokens, "access", EARLIER, null);
    await seedToken(deadTokens, "refresh", LATER, EARLIER);

    await expect(deleteStaleAnonymousOauthClients(NOW)).resolves.toBe(2);

    expect(await exists(stale)).toBe(false);
    expect(await exists(deadTokens)).toBe(false);
    for (const kept of [young, unknownAge, owned, skipsConsent, consented, liveAccess, liveRefresh]) {
      expect(await exists(kept)).toBe(true);
    }
    // The survivors keep what hung off them: nothing cascaded.
    expect(await prisma.oauthConsent.count({ where: { clientId: consented } })).toBe(1);
    expect(await prisma.oauthAccessToken.count({ where: { clientId: liveAccess } })).toBe(1);
  });

  test("is idempotent", async () => {
    await seedClient(OLD);

    await expect(deleteStaleAnonymousOauthClients(NOW)).resolves.toBe(1);
    await expect(deleteStaleAnonymousOauthClients(NOW)).resolves.toBe(0);
  });
});
