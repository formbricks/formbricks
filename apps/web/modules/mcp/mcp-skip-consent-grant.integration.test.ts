import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DELETE as revokeGrant } from "@/app/api/internal/mcp-grants/[clientId]/route";
import { GET as listGrants } from "@/app/api/internal/mcp-grants/route";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { callMcpTool, serveJwksFromAuthHandler, succeeded, toolText } from "@/integration/mcp-client";
import { createUser, grant, refresh, registerClient, signIn } from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
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

  test("a connection made before grants gets one at its next refresh, and an existing one is kept", async () => {
    const { refresh_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    await prisma.mcpGrant.deleteMany({ where: { userId: setup.userId, clientId: setup.clientId } });

    const refreshed = await refresh(setup.clientId, refresh_token);
    expect(refreshed.status, JSON.stringify(refreshed.body)).toBe(200);
    const created = await getMcpGrant(setup.userId, setup.clientId);
    expect(created).toMatchObject({ access: "all", permissions: { surveys: "write" } });

    // A grant the user narrowed is never reset by a later token.
    await prisma.mcpGrant.update({
      where: { userId_clientId: { userId: setup.userId, clientId: setup.clientId } },
      data: { permissions: { surveys: "read" } },
    });
    const again = await refresh(setup.clientId, (refreshed.body as { refresh_token: string }).refresh_token);
    expect(again.status, JSON.stringify(again.body)).toBe(200);
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
});
