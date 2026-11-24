import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ApiKeyPermission } from "@formbricks/database/prisma";
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
import { drainAuthzedOutbox } from "@/lib/authzed/outbox-processor";
import {
  clearProjectionScopeReady,
  resetSurveyVisibilityReadinessMemo,
  setProjectionScopeReady,
} from "@/lib/authzed/scope-readiness";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { createApiKey } from "@/modules/organization/settings/api-keys/lib/api-key";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "./grant";
import { lockMcpGrant, writeMcpGrant } from "./grant-store";

/**
 * ENG-4109 through `/api/mcp`, against real Postgres, SpiceDB and the real OAuth flow: an owner can
 * share a survey they created, a restriction waits for its outbound connections, and everyone else —
 * a non-owner writer, a read-only grant, an API-key connection, an id outside the grant — is refused.
 *
 * The visibility feature is an Enterprise entitlement and a projection readiness marker. The entitlement
 * is mocked on (this suite is about enforcement); the marker is set per test because `resetDb` clears it.
 */

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getAccessControlPermission: vi.fn(async () => true),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>()),
  queueAuditEventBackground: vi.fn(async () => undefined),
}));

vi.mock("@/app/api/v3/lib/audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/api/v3/lib/audit")>()),
  queueV3AuditLog: vi.fn(async () => undefined),
}));

const PASSWORD = "Correct-Horse1";
const EMAIL = "mcp-visibility@example.com";
const EVERYTHING = MCP_OAUTH_SCOPES.join(" ");

const BLOCKS = [
  {
    id: "clbk1234567890123456789099",
    name: "Main Block",
    elements: [
      {
        id: "improve",
        type: "openText",
        headline: { "en-US": "What should we improve?" },
        required: false,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

type TSetup = {
  cookie: string;
  userId: string;
  organizationId: string;
  workspaceId: string;
  outsideWorkspaceId: string;
  clientId: string;
};

const setUp = async (): Promise<TSetup> => {
  await resetDb();
  await prisma.oauthResource.createMany({
    data: [{ identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] }],
    skipDuplicates: true,
  });
  await createUser(EMAIL, PASSWORD, "Owner");
  const { cookie, userId } = await signIn(EMAIL, PASSWORD);
  const organization = await prisma.organization.create({ data: { name: "Visibility MCP" } });
  await prisma.membership.create({
    data: { userId, organizationId: organization.id, role: "owner", accepted: true },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "Inside", organizationId: organization.id },
  });
  const outside = await prisma.workspace.create({
    data: { name: "Outside", organizationId: organization.id },
  });
  await synchronizeAuthzedIntegrationFixture();
  await setProjectionScopeReady("survey", "integration");
  resetSurveyVisibilityReadinessMemo();
  const clientId = await registerClient("visibility client");
  return {
    cookie,
    userId,
    organizationId: organization.id,
    workspaceId: workspace.id,
    outsideWorkspaceId: outside.id,
    clientId,
  };
};

const setGrantFor = (
  userId: string,
  clientId: string,
  permissions: TMcpGrantPermissions,
  access?: TMcpGrantAccessSelection
) =>
  prisma.$transaction(async (tx) => {
    const ids = { userId, clientId };
    return writeMcpGrant(tx, { ...ids, before: await lockMcpGrant(tx, ids), permissions, access });
  });

const setGrant = (setup: TSetup, permissions: TMcpGrantPermissions) =>
  setGrantFor(setup.userId, setup.clientId, permissions);

const createSurvey = async (
  setup: TSetup,
  overrides: { ownerId?: string | null; visibility?: "restricted" | "workspace"; workspaceId?: string } = {}
) => {
  const survey = await prisma.survey.create({
    data: {
      name: "Survey",
      type: "link",
      workspaceId: overrides.workspaceId ?? setup.workspaceId,
      ownerId: overrides.ownerId === undefined ? setup.userId : overrides.ownerId,
      visibility: overrides.visibility ?? "workspace",
    },
  });
  await drainAuthzedOutbox();
  return survey;
};

const dataOf = (outcome: TMcpToolCallOutcome): Record<string, unknown> =>
  (JSON.parse(toolText(outcome)) as { data: Record<string, unknown> }).data;

const problemOf = (outcome: TMcpToolCallOutcome) =>
  (
    JSON.parse(toolText(outcome)) as {
      error: { status: number; code: string; detail: string; details?: unknown };
    }
  ).error;

const expectNotFound = (outcome: TMcpToolCallOutcome) => {
  expect(outcome.result?.isError, toolText(outcome)).toBe(true);
  expect(problemOf(outcome)).toMatchObject({ status: 404, code: "not_found" });
};

beforeAll(() => {
  serveJwksFromAuthHandler();
});

afterAll(async () => {
  await clearProjectionScopeReady("survey");
  resetSurveyVisibilityReadinessMemo();
});

describe("survey visibility through MCP", () => {
  let setup: TSetup;
  let accessToken: string;

  beforeEach(async () => {
    setup = await setUp();
    accessToken = (await grant(setup.cookie, setup.clientId, EVERYTHING)).access_token;
  }, 120_000);

  test("an owner creates restricted and shares it, so an API key can read it", async () => {
    await setGrant(setup, { surveys: "write" });

    const created = await callMcpTool({ accessToken }, "create_survey", {
      workspaceId: setup.workspaceId,
      name: "Seeded survey",
      blocks: BLOCKS,
    });
    expect(succeeded(created), toolText(created)).toBe(true);
    expect(dataOf(created)).toMatchObject({
      visibility: "restricted",
      access: { canManageVisibility: true },
    });
    const surveyId = dataOf(created).id as string;
    await drainAuthzedOutbox();

    const state = await callMcpTool({ accessToken }, "get_survey_visibility", { surveyId });
    expect(succeeded(state), toolText(state)).toBe(true);
    expect(dataOf(state)).toMatchObject({ visibility: "restricted", pending: null, blockers: [] });
    expect(dataOf(state).allowedTargets).toContain("workspace");
    expect(dataOf(state).access).toMatchObject({ canManageVisibility: true });

    const shared = await callMcpTool({ accessToken }, "set_survey_visibility", {
      surveyId,
      visibility: "workspace",
    });
    expect(succeeded(shared), toolText(shared)).toBe(true);
    expect(dataOf(shared)).toMatchObject({ visibility: "workspace", pending: null });

    const key = await createApiKey(setup.organizationId, setup.userId, {
      label: "seeding",
      workspacePermissions: [{ workspaceId: setup.workspaceId, permission: ApiKeyPermission.read }],
      organizationAccess: { accessControl: { read: false, write: false } },
    });
    await synchronizeAuthzedIntegrationFixture();

    const read = await callMcpTool({ apiKey: key.actualKey }, "get_survey", { surveyId });
    expect(succeeded(read), toolText(read)).toBe(true);
  });

  test("a restriction is refused while a webhook uses the survey, then succeeds", async () => {
    await setGrant(setup, { surveys: "write" });
    const survey = await createSurvey(setup);
    const webhook = await prisma.webhook.create({
      data: {
        name: "Zapier",
        url: "https://example.com/hook",
        surveyIds: [survey.id],
        workspaceId: setup.workspaceId,
      },
    });

    const blocked = await callMcpTool({ accessToken }, "set_survey_visibility", {
      surveyId: survey.id,
      visibility: "restricted",
    });
    expect(blocked.result?.isError, toolText(blocked)).toBe(true);
    expect(problemOf(blocked)).toMatchObject({
      status: 409,
      code: "visibility_blocked_by_connections",
      details: { blockers: [{ id: webhook.id, name: "Zapier", type: "webhook" }] },
    });

    await prisma.webhook.delete({ where: { id: webhook.id } });
    const restricted = await callMcpTool({ accessToken }, "set_survey_visibility", {
      surveyId: survey.id,
      visibility: "restricted",
    });
    expect(succeeded(restricted), toolText(restricted)).toBe(true);
    expect(dataOf(restricted)).toMatchObject({ visibility: "restricted" });
  });

  test("a non-owner workspace writer is refused", async () => {
    await setGrant(setup, { surveys: "write" });
    // Down to a member who only writes "Inside", through a team; the survey belongs to someone else.
    const otherOwner = await prisma.user.create({
      data: { email: "mcp-visibility-other-owner@example.com", name: "Other owner" },
    });
    await prisma.membership.update({
      where: { userId_organizationId: { userId: setup.userId, organizationId: setup.organizationId } },
      data: { role: "member" },
    });
    const team = await prisma.team.create({
      data: { name: "Writers", organizationId: setup.organizationId },
    });
    await prisma.teamUser.create({ data: { role: "contributor", teamId: team.id, userId: setup.userId } });
    await prisma.workspaceTeam.create({
      data: { permission: "readWrite", teamId: team.id, workspaceId: setup.workspaceId },
    });
    await synchronizeAuthzedIntegrationFixture();

    const survey = await createSurvey(setup, { ownerId: otherOwner.id });
    const outcome = await callMcpTool({ accessToken }, "set_survey_visibility", {
      surveyId: survey.id,
      visibility: "restricted",
    });

    expect(outcome.result?.isError, toolText(outcome)).toBe(true);
    expect(problemOf(outcome)).toMatchObject({ status: 403, code: "forbidden" });
    // The grant allows Surveys: Write; the operation refuses because the writer may not manage visibility.
    expect(problemOf(outcome).detail).not.toMatch(/^Not permitted/);
  });

  test("a read grant is not permitted to read or change visibility", async () => {
    await setGrant(setup, { surveys: "read" });
    const survey = await createSurvey(setup);

    for (const [name, args] of [
      ["get_survey_visibility", { surveyId: survey.id }],
      ["set_survey_visibility", { surveyId: survey.id, visibility: "workspace" }],
    ] as const) {
      const outcome = await callMcpTool({ accessToken }, name, args);
      expect(outcome.result?.isError, `${name}: ${toolText(outcome)}`).toBe(true);
      expect(problemOf(outcome)).toMatchObject({ status: 403, code: "forbidden" });
      expect(problemOf(outcome).detail).toContain("Surveys: Write");
    }
  });

  test("an id outside the grant answers like a made-up one and changes nothing", async () => {
    await setGrantFor(
      setup.userId,
      setup.clientId,
      { surveys: "write" },
      {
        access: "workspaces",
        workspaceIds: [setup.workspaceId],
      }
    );
    const outside = await createSurvey(setup, {
      workspaceId: setup.outsideWorkspaceId,
      visibility: "workspace",
    });

    expectNotFound(await callMcpTool({ accessToken }, "get_survey_visibility", { surveyId: outside.id }));
    expectNotFound(
      await callMcpTool({ accessToken }, "set_survey_visibility", {
        surveyId: outside.id,
        visibility: "restricted",
      })
    );
    expect(await prisma.survey.findUnique({ where: { id: outside.id } })).toMatchObject({
      visibility: "workspace",
    });
  });

  test("an API-key MCP connection cannot read or change visibility", async () => {
    const key = await createApiKey(setup.organizationId, setup.userId, {
      label: "api",
      workspacePermissions: [{ workspaceId: setup.workspaceId, permission: ApiKeyPermission.write }],
      organizationAccess: { accessControl: { read: false, write: false } },
    });
    await synchronizeAuthzedIntegrationFixture();
    const survey = await createSurvey(setup);

    const state = await callMcpTool({ apiKey: key.actualKey }, "get_survey_visibility", {
      surveyId: survey.id,
    });
    expect(state.result?.isError, toolText(state)).toBe(true);
    expect(problemOf(state)).toMatchObject({ status: 403, code: "forbidden" });

    const changed = await callMcpTool({ apiKey: key.actualKey }, "set_survey_visibility", {
      surveyId: survey.id,
      visibility: "restricted",
    });
    expect(changed.result?.isError, toolText(changed)).toBe(true);
    expect(problemOf(changed)).toMatchObject({ status: 403, code: "forbidden" });
  });

  test("a deployment without the visibility feature answers visibility_not_enabled", async () => {
    await setGrant(setup, { surveys: "write" });
    const survey = await createSurvey(setup);
    vi.mocked(getAccessControlPermission).mockResolvedValueOnce(false);

    const outcome = await callMcpTool({ accessToken }, "get_survey_visibility", {
      surveyId: survey.id,
    });

    expect(outcome.result?.isError, toolText(outcome)).toBe(true);
    expect(problemOf(outcome)).toMatchObject({ status: 403, code: "visibility_not_enabled" });
  });
});
