import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
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
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { createApiKey } from "@/modules/organization/settings/api-keys/lib/api-key";
import type { TMcpGrantPermissions } from "./grant";
import { getMcpGrant, saveMcpGrant } from "./grant-store";

/**
 * ENG-7122's tools through `POST /api/mcp`, as a client calls them: a token from the real OAuth flow, the
 * connection's grant, the tool guard, the v3 operation, Postgres and SpiceDB. Each tool works at the level
 * it declares and is refused below it with the standard "Not permitted".
 */

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>()),
  queueAuditEventBackground: vi.fn(async () => undefined),
}));

// The integration setup turns rate limiting off. The budget test turns it back on for its own calls
// only: sign-in and the OAuth flow have IP limits a whole suite would exhaust.
const rateLimiting = vi.hoisted(() => ({ disabled: true }));
vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    get RATE_LIMITING_DISABLED() {
      return rateLimiting.disabled;
    },
  };
});

const PASSWORD = "Correct-Horse1";
const EMAIL = "mcp-new-tools@example.com";
const EVERYTHING = MCP_OAUTH_SCOPES.join(" ");

type TSetup = {
  cookie: string;
  userId: string;
  organizationId: string;
  workspaceId: string;
  clientId: string;
  responseIds: string[];
  churnTagId: string;
  duplicateTagId: string;
};

/** One owner in one organization and workspace, a survey with two responses, and two tags on one. */
const setUp = async (): Promise<TSetup> => {
  await resetDb();
  await prisma.oauthResource.createMany({
    data: [{ identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] }],
    skipDuplicates: true,
  });
  await createUser(EMAIL, PASSWORD, "Tool user");
  const { cookie, userId } = await signIn(EMAIL, PASSWORD);
  const organization = await prisma.organization.create({ data: { name: "Tools org" } });
  await prisma.membership.create({
    data: { userId, organizationId: organization.id, role: "owner", accepted: true },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "Tools", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "Feedback", type: "link", status: "inProgress", workspaceId: workspace.id },
  });
  const responses = await Promise.all(
    [0, 1].map(() => prisma.response.create({ data: { surveyId: survey.id, finished: true } }))
  );
  const churn = await prisma.tag.create({ data: { name: "churn", workspaceId: workspace.id } });
  const duplicate = await prisma.tag.create({ data: { name: "chrun", workspaceId: workspace.id } });
  await prisma.tagsOnResponses.create({ data: { responseId: responses[0].id, tagId: duplicate.id } });
  await synchronizeAuthzedIntegrationFixture();
  const clientId = await registerClient("tools client");
  return {
    cookie,
    userId,
    organizationId: organization.id,
    workspaceId: workspace.id,
    clientId,
    responseIds: responses.map(({ id }) => id),
    churnTagId: churn.id,
    duplicateTagId: duplicate.id,
  };
};

const setGrant = (setup: TSetup, permissions: TMcpGrantPermissions) =>
  prisma.$transaction((tx) =>
    saveMcpGrant(tx, { userId: setup.userId, clientId: setup.clientId, permissions })
  );

const problemOf = (outcome: TMcpToolCallOutcome) =>
  (JSON.parse(toolText(outcome)) as { error: { status: number; code: string; detail: string } }).error;

const expectNotPermitted = (outcome: TMcpToolCallOutcome, needs: string) => {
  expect(outcome.result?.isError, toolText(outcome)).toBe(true);
  const problem = problemOf(outcome);
  expect(problem).toMatchObject({ status: 403, code: "forbidden" });
  expect(problem.detail).toMatch(/^Not permitted: /);
  expect(problem.detail).toContain(needs);
};

beforeAll(() => {
  serveJwksFromAuthHandler();
});

let setup: TSetup;
let token: string;
beforeEach(async () => {
  setup = await setUp();
  ({ access_token: token } = await grant(setup.cookie, setup.clientId, EVERYTHING));
}, 120_000);

describe("tag tools", () => {
  const listTags = () => callMcpTool({ accessToken: token }, "list_tags", { workspaceId: setup.workspaceId });
  const renameTag = () =>
    callMcpTool({ accessToken: token }, "update_tag", { tagId: setup.churnTagId, name: "churned" });
  const mergeTags = () =>
    callMcpTool({ accessToken: token }, "merge_tags", {
      tagId: setup.duplicateTagId,
      newTagId: setup.churnTagId,
    });

  test("a new connection's grant gives Tags at its Responses level", async () => {
    expect((await getMcpGrant(setup.userId, setup.clientId))?.permissions.tags).toBe("write");
  });

  test("Tags: No access refuses every tag tool, even with Responses: Write", async () => {
    await setGrant(setup, { responses: "write" });

    expectNotPermitted(await listTags(), "Tags: Read");
    expectNotPermitted(await renameTag(), "Tags: Write");
    expectNotPermitted(await mergeTags(), "Tags: Write");
  });

  test("Tags: Read lists tags with their counts but can't edit or merge", async () => {
    await setGrant(setup, { tags: "read" });

    const listed = await listTags();
    expect(succeeded(listed), toolText(listed)).toBe(true);
    expect(listed.result?.structuredContent?.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: setup.duplicateTagId, name: "chrun", count: 1 }),
        expect.objectContaining({ id: setup.churnTagId, name: "churn", count: 0 }),
      ])
    );
    expectNotPermitted(await renameTag(), "Tags: Write");
    expectNotPermitted(await mergeTags(), "Tags: Write");
    expect(await prisma.tag.count({ where: { workspaceId: setup.workspaceId } })).toBe(2);
  });

  test("Tags: Write renames, and merges a duplicate into the right tag", async () => {
    await setGrant(setup, { tags: "write" });

    const renamed = await renameTag();
    expect(succeeded(renamed), toolText(renamed)).toBe(true);
    expect(renamed.result?.structuredContent?.data).toMatchObject({ id: setup.churnTagId, name: "churned" });

    const merged = await mergeTags();
    expect(succeeded(merged), toolText(merged)).toBe(true);
    expect(await prisma.tag.findUnique({ where: { id: setup.duplicateTagId } })).toBeNull();
    expect(await prisma.tagsOnResponses.findMany({ where: { responseId: setup.responseIds[0] } })).toEqual([
      { responseId: setup.responseIds[0], tagId: setup.churnTagId },
    ]);
  });

  test("a tag in another workspace can't be reached, or merged into", async () => {
    await setGrant(setup, { tags: "write" });
    const elsewhere = await prisma.organization.create({ data: { name: "Not mine" } });
    const foreignWorkspace = await prisma.workspace.create({
      data: { name: "Theirs", organizationId: elsewhere.id },
    });
    const foreignTag = await prisma.tag.create({
      data: { name: "theirs", workspaceId: foreignWorkspace.id },
    });
    await synchronizeAuthzedIntegrationFixture();

    const renamed = await callMcpTool({ accessToken: token }, "update_tag", {
      tagId: foreignTag.id,
      name: "mine now",
    });
    expect(problemOf(renamed).status).toBe(403);
    const merged = await callMcpTool({ accessToken: token }, "merge_tags", {
      tagId: setup.duplicateTagId,
      newTagId: foreignTag.id,
    });
    expect(problemOf(merged).status).toBe(403);
    expect(await prisma.tag.findUnique({ where: { id: foreignTag.id } })).toMatchObject({ name: "theirs" });
    expect(await prisma.tag.findUnique({ where: { id: setup.duplicateTagId } })).not.toBeNull();
  });

  test("an API key has no tag access, as on /api/v3/tags", async () => {
    const { actualKey } = await createApiKey(setup.organizationId, setup.userId, {
      label: "mcp",
      workspacePermissions: [{ workspaceId: setup.workspaceId, permission: "manage" }],
      organizationAccess: { accessControl: { read: false, write: false } },
    });
    await synchronizeAuthzedIntegrationFixture();

    const listed = await callMcpTool({ apiKey: actualKey }, "list_tags", { workspaceId: setup.workspaceId });
    expect(problemOf(listed)).toMatchObject({ status: 403 });
    expect(problemOf(listed).detail).toContain("signed-in user");
  });
});

describe("set_responses_outcome", () => {
  const markLowQuality = () =>
    callMcpTool({ accessToken: token }, "set_responses_outcome", {
      workspaceId: setup.workspaceId,
      ids: setup.responseIds,
      outcome: "lowQuality",
    });

  test("Responses: Read can't set the outcome", async () => {
    await setGrant(setup, { responses: "read" });

    expectNotPermitted(await markLowQuality(), "Responses: Write");
    expect(await prisma.response.count({ where: { outcome: "lowQuality" } })).toBe(0);
  });

  test("Responses: Write marks many responses Low quality at once, and restores them", async () => {
    await setGrant(setup, { responses: "write" });

    const marked = await markLowQuality();
    expect(succeeded(marked), toolText(marked)).toBe(true);
    expect(marked.result?.structuredContent?.data).toEqual({ updated: 2 });
    expect(await prisma.response.count({ where: { outcome: "lowQuality" } })).toBe(2);

    const restored = await callMcpTool({ accessToken: token }, "set_responses_outcome", {
      workspaceId: setup.workspaceId,
      ids: setup.responseIds,
      outcome: null,
    });
    expect(succeeded(restored), toolText(restored)).toBe(true);
    expect(await prisma.response.count({ where: { outcome: "lowQuality" } })).toBe(0);
  });
});

describe("generate_survey", () => {
  const generate = () =>
    callMcpTool({ accessToken: token }, "generate_survey", {
      workspaceId: setup.workspaceId,
      prompt: "Ask new users what slowed them down during onboarding",
    });

  test("Surveys: Read can't generate", async () => {
    await setGrant(setup, { surveys: "read" });

    expectNotPermitted(await generate(), "Surveys: Write");
  });

  /** The harness configures no AI provider, so a permitted call stops at the organization's AI gate. */
  test("Surveys: Write reaches the AI gate the REST route uses", async () => {
    await setGrant(setup, { surveys: "write" });

    const generated = await generate();
    expect(generated.result?.isError, toolText(generated)).toBe(true);
    expect(problemOf(generated).code).toMatch(/^ai_/);
    expect(await prisma.survey.count()).toBe(1);
  });

  /** 10 a minute per user, charged by the operation, so the MCP path spends from the REST budget. */
  test("the survey-generation budget holds on the MCP path", async () => {
    await setGrant(setup, { surveys: "write" });
    rateLimiting.disabled = false;
    try {
      for (let call = 0; call < 10; call += 1) {
        expect(problemOf(await generate()).status).not.toBe(429);
      }
      expect(problemOf(await generate())).toMatchObject({ status: 429 });
    } finally {
      rateLimiting.disabled = true;
    }
  });
});
