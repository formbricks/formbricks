import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PATCH } from "@/app/api/internal/mcp-grants/[clientId]/route";
import { GET } from "@/app/api/internal/mcp-grants/route";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import {
  type TMcpToolCallOutcome,
  callMcpTool,
  serveJwksFromAuthHandler,
  succeeded,
  toolText,
} from "@/integration/mcp-client";
import { createUser, grant, registerClient, signIn } from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { queueAuditEvent, queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { getMcpGrant } from "./grant-store";
import { MCP_PERMISSIONS } from "./permissions";

/**
 * ENG-7152 against the real Better Auth instance, Postgres and SpiceDB: Authorized apps' Edit, through the
 * internal grant routes, changes what the client may do from its next `/api/mcp` call, with the token it
 * already holds. Tokens come from the real OAuth flow; the session the internal routes read is the signed-in
 * user's, swapped for another user's to prove a grant is only ever its owner's.
 */

const session = vi.hoisted(() => ({ userId: "" }));

vi.mock("@/modules/auth/lib/session", () => ({
  getSession: vi.fn(async () => (session.userId ? { user: { id: session.userId } } : null)),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>()),
  queueAuditEvent: vi.fn(async () => undefined),
  queueAuditEventBackground: vi.fn(async () => undefined),
}));

const BLOCKS = [
  {
    id: "clbk1234567890123456789099",
    name: "Main Block",
    elements: [
      {
        id: "improve",
        type: "openText",
        headline: { default: "What should we improve?" },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

const PASSWORD = "Correct-Horse1";
const EVERYTHING = MCP_OAUTH_SCOPES.join(" ");

type TSetup = {
  cookie: string;
  userId: string;
  organizationId: string;
  workspaceId: string;
  surveyId: string;
  clientId: string;
};

const setUp = async (): Promise<TSetup> => {
  await resetDb();
  await prisma.oauthResource.createMany({
    data: [{ identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] }],
    skipDuplicates: true,
  });
  await createUser("authorized-apps@example.com", PASSWORD, "Grant owner");
  const { cookie, userId } = await signIn("authorized-apps@example.com", PASSWORD);
  const organization = await prisma.organization.create({ data: { name: "Edit org" } });
  await prisma.membership.create({
    data: { userId, organizationId: organization.id, role: "owner", accepted: true },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "Edit", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "Draft", type: "link", workspaceId: workspace.id, blocks: BLOCKS as never },
  });
  await synchronizeAuthzedIntegrationFixture();
  const clientId = await registerClient("edit client");
  session.userId = userId;
  return {
    cookie,
    userId,
    organizationId: organization.id,
    workspaceId: workspace.id,
    surveyId: survey.id,
    clientId,
  };
};

const listConnections = async () => {
  const response = await GET(new NextRequest("http://localhost:3000/api/internal/mcp-grants"), {
    params: Promise.resolve({}),
  } as never);
  return { status: response.status, body: await response.json() };
};

const editGrant = async (clientId: string, permissions: Record<string, string>) => {
  const response = await PATCH(
    new NextRequest(`http://localhost:3000/api/internal/mcp-grants/${clientId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ permissions }),
    }),
    { params: Promise.resolve({ clientId }) } as never
  );
  return { status: response.status, body: await response.json() };
};

const listSurveys = (accessToken: string, setup: TSetup) =>
  callMcpTool({ accessToken }, "list_surveys", { workspaceId: setup.workspaceId });

const renameSurvey = (accessToken: string, setup: TSetup) =>
  callMcpTool({ accessToken }, "patch_survey", { surveyId: setup.surveyId, data: { name: "Renamed" } });

const expectNotPermitted = (outcome: TMcpToolCallOutcome, needs: string) => {
  expect(outcome.result?.isError, toolText(outcome)).toBe(true);
  expect(toolText(outcome)).toContain(`Not permitted: `);
  expect(toolText(outcome)).toContain(needs);
};

beforeAll(() => {
  serveJwksFromAuthHandler();
});

describe("Authorized apps' Edit", () => {
  let setup: TSetup;
  beforeEach(async () => {
    vi.mocked(queueAuditEvent).mockClear();
    setup = await setUp();
  }, 120_000);

  test("lists each connection with its grant, one row per client connected", async () => {
    await grant(setup.cookie, setup.clientId, "openid surveys:write responses:read");
    const secondClientId = await registerClient("edit client");
    await grant(setup.cookie, secondClientId, "openid dashboards:read");

    const { status, body } = await listConnections();

    expect(status).toBe(200);
    expect(body.data.isDashboardViewer).toBe(false);
    const byClient = Object.fromEntries(
      (body.data.connections as { clientId: string }[]).map((connection) => [connection.clientId, connection])
    );
    expect(Object.keys(byClient).sort()).toEqual([setup.clientId, secondClientId].sort());
    expect(byClient[setup.clientId]).toMatchObject({
      clientName: "edit client",
      permissions: { surveys: "write", creatives: "write", surveyStyling: "write", responses: "read" },
      cap: { surveys: "write", creatives: "write", surveyStyling: "write", responses: "read", tags: "read" },
    });
    expect(byClient[secondClientId]).toMatchObject({ permissions: { charts: "read", dashboards: "read" } });
  });

  test("narrowing applies to the next call, with a token minted before the edit, and is audited", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    expect(succeeded(await renameSurvey(access_token, setup))).toBe(true);
    const before = await getMcpGrant(setup.userId, setup.clientId);

    const edited = await editGrant(setup.clientId, { surveys: "read" });

    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
    // An Edit that names no organization & workspace access keeps the grant's (All access here).
    expect(edited.body.data).toEqual({
      clientId: setup.clientId,
      permissions: { surveys: "read" },
      access: { access: "all" },
    });
    expect(succeeded(await listSurveys(access_token, setup))).toBe(true);
    expectNotPermitted(await renameSurvey(access_token, setup), "Surveys: Write");
    // Filed under the organization the grant reaches, with both grants whole: every permission the
    // edit took away reads as a change to "none", not as a key that vanished from a diff.
    const NO_ACCESS = Object.fromEntries(
      Object.keys(MCP_PERMISSIONS).map((permission) => [permission, "none"])
    );
    expect(queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "mcpGrant",
        targetId: before?.id,
        userId: setup.userId,
        userType: "user",
        organizationId: setup.organizationId,
        status: "success",
        oldObject: null,
        newObject: {
          before: {
            clientId: setup.clientId,
            access: "all",
            permissions: { ...NO_ACCESS, ...before?.permissions },
          },
          after: { clientId: setup.clientId, access: "all", permissions: { ...NO_ACCESS, surveys: "read" } },
        },
      })
    );
    expect(queueAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ targetType: "mcpGrant", status: "success" })
    );
  });

  test("widening within the scopes applies to the next call, with no new token", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    expect((await editGrant(setup.clientId, { surveys: "read" })).status).toBe(200);
    expectNotPermitted(await renameSurvey(access_token, setup), "Surveys: Write");

    expect((await editGrant(setup.clientId, { surveys: "write" })).status).toBe(200);

    const renamed = await renameSurvey(access_token, setup);
    expect(succeeded(renamed), toolText(renamed)).toBe(true);
  });

  test("can't widen past what the client's scopes ask for", async () => {
    await grant(setup.cookie, setup.clientId, "openid surveys:read");

    const edited = await editGrant(setup.clientId, { surveys: "write" });

    expect(edited.status).toBe(422);
    expect(edited.body.code).toBe("mcp_grant_beyond_scopes");
    expect((await getMcpGrant(setup.userId, setup.clientId))?.permissions).toEqual({
      surveys: "read",
      creatives: "read",
      surveyStyling: "read",
    });
  });

  test("another user neither sees nor changes the grant", async () => {
    await grant(setup.cookie, setup.clientId, EVERYTHING);
    const before = await getMcpGrant(setup.userId, setup.clientId);
    const other = await prisma.user.create({
      data: { name: "Someone else", email: "someone-else@example.com", emailVerified: true },
    });
    session.userId = other.id;

    const listed = await listConnections();
    const edited = await editGrant(setup.clientId, { surveys: "read" });

    expect(listed.body.data.connections).toEqual([]);
    expect(edited.status).toBe(403);
    expect(await getMcpGrant(setup.userId, setup.clientId)).toEqual(before);
  });

  test("a revoked connection can't be edited back to life", async () => {
    await grant(setup.cookie, setup.clientId, EVERYTHING);
    const consent = await prisma.oauthConsent.findFirstOrThrow({
      where: { userId: setup.userId, clientId: setup.clientId },
    });
    await auth.api.deleteOAuthConsent({
      body: { id: consent.id },
      headers: new Headers({ cookie: setup.cookie }),
    });

    expect((await editGrant(setup.clientId, { surveys: "read" })).status).toBe(403);
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
    expect((await listConnections()).body.data.connections).toEqual([]);
  });
});
