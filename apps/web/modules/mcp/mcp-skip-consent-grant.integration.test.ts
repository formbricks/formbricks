import { decodeJwt } from "jose";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { DELETE as revokeGrant } from "@/app/api/internal/mcp-grants/[clientId]/route";
import { GET as listGrants } from "@/app/api/internal/mcp-grants/route";
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
} from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";
import { mcpGrantAccessTokenClaims } from "@/modules/auth/lib/mcp-grant-token-claim";
import { revokeMcpClient } from "@/modules/auth/lib/oauth-grant-revocation";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
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
const waitForBlockOn = async (tx: Prisma.TransactionClient): Promise<void> => {
  const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS "pid"`;
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS "waiting" FROM pg_stat_activity
      WHERE ${pid}::int = ANY(pg_blocking_pids("pid"))`;
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("nothing blocked on the transaction's lock");
};

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
    } as never);
    const { data } = (await listed.json()) as { data: { clients: { clientId: string; access: unknown }[] } };
    expect(data.clients).toEqual([
      expect.objectContaining({ clientId: setup.clientId, access: { access: "all" } }),
    ]);

    const revoked = await revokeGrant(
      new NextRequest(`http://localhost:3000/api/internal/mcp-grants/${setup.clientId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ clientId: setup.clientId }) } as never
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
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    await grant(setup.cookie, setup.clientId, EVERYTHING);
    expect(await getMcpGrant(setup.userId, setup.clientId)).not.toBeNull();
  });
});
