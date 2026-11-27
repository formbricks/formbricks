import { decodeJwt } from "jose";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DELETE as revokeGrant } from "@/app/api/internal/mcp-grants/[clientId]/route";
import { GET as listGrants } from "@/app/api/internal/mcp-grants/route";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { callMcpTool, serveJwksFromAuthHandler, succeeded, toolText } from "@/integration/mcp-client";
import {
  approve,
  authorize,
  createUser,
  exchangeCode,
  grant,
  refresh,
  registerClient,
  signIn,
  waitPastRevocation,
} from "@/integration/oauth-flow";
import { lockUserRow, waitForBlockOn } from "@/integration/postgres-locks";
import { resetDb } from "@/integration/reset-db";
import { revokeMcpClient } from "@/modules/auth/lib/mcp-grant-revocation";
import { mcpGrantAccessTokenClaims } from "@/modules/auth/lib/mcp-grant-token-claim";
import { markOAuthRevocation } from "@/modules/auth/lib/oauth-revocation-marker";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { redisSecondaryStorage } from "@/modules/auth/lib/secondary-storage";
// The data migration under test (auto-discovered by the migration runner at deploy).
import { backfillSkipConsentMcpGrants } from "../../../../packages/database/migration/20261112150000_backfill_skip_consent_mcp_grants/migration";
import { getMcpGrant } from "./grant-store";

/**
 * A client registered with `skipConsent` (a trusted first-party client) is authorized without a consent
 * screen, so the consent hook that saves a grant never runs. Its tokens are given a grant when they are
 * issued instead, by the migration's rule: All access, each permission at its scope family's level, and
 * Tags and Audience at No access. Driven through the real OAuth flow and `POST /api/mcp`.
 */

/** The signed-in user the internal grant routes read, as Authorized apps sends it. */
const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/modules/auth/lib/session", () => ({
  getSession: vi.fn(async () => (session.userId ? { user: { id: session.userId } } : null)),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>()),
  queueAuditEventBackground: vi.fn(async () => undefined),
}));

// The real grant claim, which a test can turn off for one token to mint one as the previous release did.
vi.mock("@/modules/auth/lib/mcp-grant-token-claim", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/auth/lib/mcp-grant-token-claim")>();
  return { ...actual, mcpGrantAccessTokenClaims: vi.fn(actual.mcpGrantAccessTokenClaims) };
});

const PASSWORD = "Correct-Horse1";
const EMAIL = "mcp-skip-consent@example.com";
const EVERYTHING = MCP_OAUTH_SCOPES.join(" ");

type TSetup = { cookie: string; userId: string; workspaceId: string; clientId: string };

const setUp = async (): Promise<TSetup> => {
  await resetDb();
  await prisma.oauthResource.createMany({
    data: [{ identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] }],
    skipDuplicates: true,
  });
  await createUser(EMAIL, PASSWORD, "First-party owner");
  const { cookie, userId } = await signIn(EMAIL, PASSWORD);
  const organization = await prisma.organization.create({ data: { name: "First-party org" } });
  await prisma.membership.create({
    data: { userId, organizationId: organization.id, role: "owner", accepted: true },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "First-party", organizationId: organization.id },
  });
  await synchronizeAuthzedIntegrationFixture();
  const clientId = await registerClient("first-party client");
  await prisma.oauthClient.update({ where: { clientId }, data: { skipConsent: true } });
  return { cookie, userId, workspaceId: workspace.id, clientId };
};

/**
 * Resolves once a statement is blocked on a lock the transaction `tx` holds. Scoped to `tx`'s own backend
 * through `pg_blocking_pids`, and fails if it never happens, so a race test can't pass by running in order.
 */
/** Refresh tokens the client still holds for the user: not revoked and not expired. */
const liveRefreshTokens = (userId: string, clientId: string): Promise<number> =>
  prisma.oauthRefreshToken.count({
    where: { userId, clientId, revoked: null, expiresAt: { gt: new Date() } },
  });

beforeAll(() => {
  serveJwksFromAuthHandler();
});

describe("a skipConsent client", () => {
  let setup: TSetup;
  beforeEach(async () => {
    setup = await setUp();
  }, 120_000);

  test("gets a grant with its first token, and its calls through /api/mcp go through", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);

    expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
      access: "all",
      permissions: {
        surveys: "write",
        creatives: "write",
        surveyStyling: "write",
        responses: "write",
        workflows: "write",
        workflowRuns: "read",
        charts: "write",
        dashboards: "write",
        feedbackRecords: "write",
        feedbackDatasets: "read",
      },
    });
    // Tags and Audience start at No access, as for every connection made before grants.
    const stored = await getMcpGrant(setup.userId, setup.clientId);
    for (const permission of ["tags", "contacts", "contactAttributes", "segments", "actionClasses"]) {
      expect(stored?.permissions, permission).not.toHaveProperty(permission);
    }

    const outcome = await callMcpTool({ accessToken: access_token }, "list_surveys", {
      workspaceId: setup.workspaceId,
    });
    expect(succeeded(outcome), toolText(outcome)).toBe(true);
  });

  test("gives each permission only the level its scopes give", async () => {
    await grant(setup.cookie, setup.clientId, "surveys:read responses:write offline_access");

    expect((await getMcpGrant(setup.userId, setup.clientId))?.permissions).toEqual({
      surveys: "read",
      creatives: "read",
      surveyStyling: "read",
      responses: "write",
    });
  });

  test("a connection made before grants gets one from the migration, dated so its tokens keep working", async () => {
    // What an upgraded instance holds: the client's refresh token, no grant and no consent, and an access
    // token without the grant claim, issued by the previous release a while after the connection was made.
    // Issued through the consent screen with the client not yet first-party, since a skipConsent code
    // exchange now always brings a grant.
    await prisma.oauthClient.update({ where: { clientId: setup.clientId }, data: { skipConsent: false } });
    const { code, verifier } = await approve(setup.cookie, setup.clientId, EVERYTHING);
    await prisma.mcpGrant.deleteMany({ where: { userId: setup.userId, clientId: setup.clientId } });
    // The previous release minted tokens without the grant claim.
    vi.mocked(mcpGrantAccessTokenClaims).mockResolvedValueOnce({});
    const exchanged = await exchangeCode(setup.clientId, code, verifier);
    const { access_token, refresh_token } = exchanged.body as { access_token: string; refresh_token: string };
    expect(decodeJwt(access_token)).not.toHaveProperty("mcp_grant");
    await prisma.oauthConsent.deleteMany({ where: { userId: setup.userId } });
    await prisma.oauthClient.update({ where: { clientId: setup.clientId }, data: { skipConsent: true } });
    await prisma.oauthRefreshToken.updateMany({
      where: { userId: setup.userId },
      data: { createdAt: new Date(Date.now() - 60_000) },
    });
    // The backfill runs in a later second than the token was issued: a grant it dated when it ran would be
    // newer than the token, and the token refused.
    await new Promise((resolve) => setTimeout(resolve, 1_100));

    await backfillSkipConsentMcpGrants.run!({ prisma: prisma as never, tx: prisma as never });
    const backfilled = await getMcpGrant(setup.userId, setup.clientId);
    await backfillSkipConsentMcpGrants.run!({ prisma: prisma as never, tx: prisma as never });

    expect(backfilled).toMatchObject({
      access: "all",
      permissions: { surveys: "write", dashboards: "write" },
    });
    expect(backfilled?.permissions).not.toHaveProperty("tags");
    expect(backfilled?.permissions).not.toHaveProperty("contacts");
    expect(await getMcpGrant(setup.userId, setup.clientId)).toEqual(backfilled);
    const outcome = await callMcpTool({ accessToken: access_token }, "list_surveys", {
      workspaceId: setup.workspaceId,
    });
    expect(succeeded(outcome), toolText(outcome)).toBe(true);
    expect((await refresh(setup.clientId, refresh_token)).status).toBe(200);
  });

  test("a connection without a grant is refused at its refresh, and its tokens end", async () => {
    const { refresh_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    await prisma.mcpGrant.deleteMany({ where: { userId: setup.userId, clientId: setup.clientId } });

    const refreshed = await refresh(setup.clientId, refresh_token);

    expect(refreshed.body.error, JSON.stringify(refreshed.body)).toBe("invalid_grant");
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
    expect(await liveRefreshTokens(setup.userId, setup.clientId)).toBe(0);
  });

  test("a later token never resets a grant the user narrowed", async () => {
    const { refresh_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    await prisma.mcpGrant.update({
      where: { userId_clientId: { userId: setup.userId, clientId: setup.clientId } },
      data: { permissions: { surveys: "read" } },
    });

    expect((await refresh(setup.clientId, refresh_token)).status).toBe(200);
    await grant(setup.cookie, setup.clientId, EVERYTHING);
    expect((await getMcpGrant(setup.userId, setup.clientId))?.permissions).toEqual({ surveys: "read" });
  });

  // Spec stories 29 and 38: Authorized apps lists it like any other client, and Revoke ends it.
  test("is listed on Authorized apps, and Revoke ends its grant and its current token's access", async () => {
    const { access_token, refresh_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    session.userId = setup.userId;

    const listed = await listGrants(new NextRequest("http://localhost:3000/api/internal/mcp-grants"), {
      params: Promise.resolve({}),
    });
    const { data } = (await listed.json()) as { data: { clients: { clientId: string; access: unknown }[] } };
    expect(data.clients).toEqual([
      expect.objectContaining({ clientId: setup.clientId, access: { access: "all" } }),
    ]);

    const revoked = await revokeGrant(
      new NextRequest(`http://localhost:3000/api/internal/mcp-grants/${setup.clientId}`, {
        method: "DELETE",
        headers: SAME_ORIGIN_HEADERS,
      }),
      { params: Promise.resolve({ clientId: setup.clientId }) }
    );
    expect(revoked.status).toBe(200);

    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
    // The access token is a JWT that can't be revoked, but without a grant its next call answers 401.
    const after = await callMcpTool({ accessToken: access_token }, "list_surveys", {
      workspaceId: setup.workspaceId,
    });
    expect(after.status).toBe(401);
    // And the refresh token can't mint a new one, so the grant doesn't come back.
    expect((await refresh(setup.clientId, refresh_token)).status).not.toBe(200);
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
  });

  // The provider rotates a refresh token in two steps outside any transaction: it marks the presented
  // token rotated, then inserts the new one. A Revoke that commits between them revokes nothing the
  // refresh still holds, and the new token is inserted live after it.
  test("a refresh that rotates before Revoke and issues after it gets no grant and no live token", async () => {
    const { refresh_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);

    let raced: ReturnType<typeof refresh> | undefined;
    await prisma.$transaction(
      async (tx) => {
        // Holding the client row holds the new refresh token's insert (its foreign key) after the
        // rotation's update, which takes no lock on the client, has committed.
        await tx.$queryRaw`SELECT 1 FROM "oauthClient" WHERE "clientId" = ${setup.clientId} FOR UPDATE`;
        raced = refresh(setup.clientId, refresh_token);
        await waitForBlockOn(tx);
        expect(await revokeMcpClient({ userId: setup.userId, clientId: setup.clientId })).not.toBeNull();
      },
      { timeout: 15_000 }
    );

    const refreshed = await (raced as ReturnType<typeof refresh>);
    expect(refreshed.body.error, JSON.stringify(refreshed.body)).toBe("invalid_grant");
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
    expect(await liveRefreshTokens(setup.userId, setup.clientId)).toBe(0);
  });

  // A skipConsent client that asked for no MCP scope has neither a grant nor a consent to order its refresh
  // against an ending of the user's access. The user's row does: the revocation holds it FOR UPDATE while
  // it revokes the tokens, having marked first; the refresh reads the mark once it can lock the row.
  test("an identity-only refresh racing a revocation leaves no live token", async () => {
    const { refresh_token } = await grant(setup.cookie, setup.clientId, "openid offline_access");
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();

    let raced: ReturnType<typeof refresh> | undefined;
    await prisma.$transaction(
      async (tx) => {
        // What a revocation holds while it ends the user's tokens.
        await lockUserRow(tx, setup.userId);
        raced = refresh(setup.clientId, refresh_token);
        await waitForBlockOn(tx);
        await markOAuthRevocation({ userId: setup.userId, clientId: setup.clientId });
        await tx.oauthRefreshToken.updateMany({
          where: { userId: setup.userId, clientId: setup.clientId, revoked: null },
          data: { revoked: new Date() },
        });
      },
      { timeout: 15_000 }
    );

    const refreshed = await (raced as ReturnType<typeof refresh>);
    expect(refreshed.body.error, JSON.stringify(refreshed.body)).toBe("invalid_grant");
    expect(await liveRefreshTokens(setup.userId, setup.clientId)).toBe(0);
  });

  // A sign-in code lives 10 minutes outside PostgreSQL, so Revoke can't delete it. One issued before
  // Revoke and exchanged after it would give the client a new grant: the revoked client would be back.
  test("a sign-in code issued before Revoke can't bring the client back", async () => {
    await grant(setup.cookie, setup.clientId, EVERYTHING);
    const pending = await authorize(setup.cookie, setup.clientId, EVERYTHING);
    const code = pending.target.searchParams.get("code");
    expect(code, pending.target.toString()).toBeTruthy();

    expect(await revokeMcpClient({ userId: setup.userId, clientId: setup.clientId })).not.toBeNull();
    const exchanged = await exchangeCode(setup.clientId, code as string, pending.verifier);

    expect(exchanged.body.error, JSON.stringify(exchanged.body)).toBe("invalid_grant");
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();

    // Authorizing again after the Revoke is a new connection, and works.
    await waitPastRevocation();
    await grant(setup.cookie, setup.clientId, EVERYTHING);
    expect(await getMcpGrant(setup.userId, setup.clientId)).not.toBeNull();
  });

  // The provider spends the code after the token endpoint's before-hook read the revocation mark, so a
  // Revoke can land in between. The claim re-checks the mark with the code's issue time, under the user's
  // row, which a revocation holds while it deletes: the exchange then names no grant, and its calls fail.
  test("a Revoke that lands between the code's check and its exchange still leaves no grant", async () => {
    await grant(setup.cookie, setup.clientId, EVERYTHING);
    const pending = await authorize(setup.cookie, setup.clientId, EVERYTHING);
    const code = pending.target.searchParams.get("code");
    expect(code, pending.target.toString()).toBeTruthy();

    let exchanged: ReturnType<typeof exchangeCode> | undefined;
    await prisma.$transaction(
      async (tx) => {
        // The exchange passes the before-hook's mark read (nothing marked yet) and waits here, the lock
        // the claim takes `FOR KEY SHARE` before it reads the mark again.
        await lockUserRow(tx, setup.userId);
        exchanged = exchangeCode(setup.clientId, code as string, pending.verifier);
        await waitForBlockOn(tx);
        // What Revoke does: its mark first, then, under the user's row this transaction holds as Revoke's
        // own does, the delete of the grant the earlier connect left.
        await markOAuthRevocation({ userId: setup.userId, clientId: setup.clientId });
        await tx.mcpGrant.deleteMany({ where: { userId: setup.userId, clientId: setup.clientId } });
      },
      { timeout: 15_000 }
    );

    const response = await (exchanged as ReturnType<typeof exchangeCode>);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();

    const denied = await callMcpTool({ accessToken: response.body.access_token as string }, "list_surveys", {
      workspaceId: setup.workspaceId,
    });
    expect(denied.status).toBe(401);
  });
});

// Two revocations of one connection can finish out of order: the later one marks first, and the earlier
// one's write lands second. Against real Valkey, the mark must keep the later time, or a code issued
// between the two would pass the exchange's check.
describe("the revocation mark", () => {
  test("never moves back when an older write lands after a newer one", async () => {
    const key = `oauth-revoked:it-${Date.now().toString()}`;
    await redisSecondaryStorage.setMax(key, 3_000, 30);
    await redisSecondaryStorage.setMax(key, 1_000, 60);
    expect(await redisSecondaryStorage.get(key)).toBe("3000");

    await redisSecondaryStorage.setMax(key, 5_000, 60);
    expect(await redisSecondaryStorage.get(key)).toBe("5000");
    await redisSecondaryStorage.delete(key);
  });
});
