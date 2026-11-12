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
// The data migrations the reconnect path depends on (auto-discovered by the migration runner at deploy).
import { grantAudienceScope } from "../../../../packages/database/migration/20261112130000_grant_audience_scope/migration";
import { grantAudienceScopeToClients } from "../../../../packages/database/migration/20261112130001_grant_audience_scope_to_clients/migration";
import type { TMcpGrantPermissions } from "./grant";
import { getMcpGrant, saveMcpGrant } from "./grant-store";

/**
 * ENG-7151 against the real Better Auth instance, Postgres and SpiceDB: the Audience tools through
 * `/api/mcp` with tokens from the real OAuth flow. Each tool runs with its permission and is "not
 * permitted" without it; the contacts entitlement still applies; and a client connected before
 * `audience:read` existed gets Audience only by reconnecting once.
 *
 * The contacts entitlement is a licence question this harness has no licence for, so it is the one
 * boundary faked, as the survey import suite does.
 */

const entitlements = vi.hoisted(() => ({ contacts: true }));
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsContactsEnabled: async () => entitlements.contacts,
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>()),
  queueAuditEventBackground: vi.fn(async () => undefined),
}));

const PASSWORD = "Correct-Horse1";
const EMAIL = "mcp-audience@example.com";
const EVERYTHING = MCP_OAUTH_SCOPES.join(" ");

/** What a client registered, and its user consented to, before ENG-7151: every scope but `audience:read`. */
const PRE_AUDIENCE_SCOPES = MCP_OAUTH_SCOPES.filter((scope) => scope !== "audience:read");

type TSetup = {
  cookie: string;
  userId: string;
  workspaceId: string;
  foreignWorkspaceId: string;
  clientId: string;
  contactId: string;
  segmentId: string;
  actionClassId: string;
};

/**
 * One owner in one organization with one workspace holding a contact (email and plan), a public segment
 * and a code action, plus a second organization the user does not belong to with a contact of its own.
 */
const setUp = async (): Promise<TSetup> => {
  await resetDb();
  entitlements.contacts = true;
  await prisma.oauthResource.createMany({
    data: [{ identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] }],
    skipDuplicates: true,
  });
  await createUser(EMAIL, PASSWORD, "Audience owner");
  const { cookie, userId } = await signIn(EMAIL, PASSWORD);

  const organization = await prisma.organization.create({ data: { name: "Audience org" } });
  await prisma.membership.create({
    data: { userId, organizationId: organization.id, role: "owner", accepted: true },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "Audience", organizationId: organization.id },
  });
  const emailKey = await prisma.contactAttributeKey.create({
    data: { key: "email", name: "Email", type: "default", workspaceId: workspace.id },
  });
  const planKey = await prisma.contactAttributeKey.create({
    data: { key: "plan", name: "Plan", workspaceId: workspace.id },
  });
  const contact = await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      attributes: {
        create: [
          { attributeKeyId: emailKey.id, value: "ada@example.com" },
          { attributeKeyId: planKey.id, value: "pro" },
        ],
      },
    },
  });
  const segment = await prisma.segment.create({
    data: { title: "Pro users", isPrivate: false, filters: [], workspaceId: workspace.id },
  });
  const actionClass = await prisma.actionClass.create({
    data: { name: "Checkout", type: "code", key: "checkout", workspaceId: workspace.id },
  });

  const foreignOrganization = await prisma.organization.create({ data: { name: "Someone else's" } });
  const foreignWorkspace = await prisma.workspace.create({
    data: { name: "Foreign", organizationId: foreignOrganization.id },
  });
  await prisma.contact.create({ data: { workspaceId: foreignWorkspace.id } });

  await synchronizeAuthzedIntegrationFixture();
  const clientId = await registerClient("audience client");
  return {
    cookie,
    userId,
    workspaceId: workspace.id,
    foreignWorkspaceId: foreignWorkspace.id,
    clientId,
    contactId: contact.id,
    segmentId: segment.id,
    actionClassId: actionClass.id,
  };
};

const setGrant = (setup: TSetup, permissions: TMcpGrantPermissions) =>
  prisma.$transaction((tx) =>
    saveMcpGrant(tx, { userId: setup.userId, clientId: setup.clientId, permissions })
  );

/** Every Audience tool, the arguments it is called with, and the permission the grant must give. */
const TOOLS = [
  { tool: "list_contacts", args: {}, permission: "contacts", needs: "Contacts: Read" },
  {
    tool: "list_contact_attribute_keys",
    args: {},
    permission: "contactAttributes",
    needs: "Contact attributes: Read",
  },
  {
    tool: "list_contact_attribute_values",
    args: { key: "plan" },
    permission: "contactAttributes",
    needs: "Contact attributes: Read",
  },
  { tool: "list_segments", args: {}, permission: "segments", needs: "Segments: Read" },
  { tool: "list_action_classes", args: {}, permission: "actionClasses", needs: "Action classes: Read" },
] as const;

const callTool = (accessToken: string, setup: TSetup, tool: string, args: Record<string, unknown> = {}) =>
  callMcpTool({ accessToken }, tool, { workspaceId: setup.workspaceId, ...args });

const dataOf = (outcome: TMcpToolCallOutcome) => (JSON.parse(toolText(outcome)) as { data: unknown }).data;

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

describe("the Audience tools", () => {
  let setup: TSetup;
  beforeEach(async () => {
    setup = await setUp();
  }, 120_000);

  test("Allow with audience:read gives every Audience permission at Read", async () => {
    await grant(setup.cookie, setup.clientId, "openid offline_access audience:read");

    expect((await getMcpGrant(setup.userId, setup.clientId))?.permissions).toEqual({
      contacts: "read",
      contactAttributes: "read",
      segments: "read",
      actionClasses: "read",
    });
  });

  test("read the workspace's audience with the permissions", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);

    const contacts = await callTool(access_token, setup, "list_contacts");
    expect(succeeded(contacts), toolText(contacts)).toBe(true);
    expect(dataOf(contacts)).toEqual([
      expect.objectContaining({ id: setup.contactId, email: "ada@example.com" }),
    ]);

    const keys = await callTool(access_token, setup, "list_contact_attribute_keys");
    expect(succeeded(keys), toolText(keys)).toBe(true);
    expect((dataOf(keys) as { key: string }[]).map(({ key }) => key).sort()).toEqual(["email", "plan"]);

    const values = await callTool(access_token, setup, "list_contact_attribute_values", { key: "plan" });
    expect(succeeded(values), toolText(values)).toBe(true);
    expect(dataOf(values)).toEqual([{ value: "pro" }]);

    const segments = await callTool(access_token, setup, "list_segments");
    expect(succeeded(segments), toolText(segments)).toBe(true);
    expect(dataOf(segments)).toEqual([expect.objectContaining({ id: setup.segmentId, title: "Pro users" })]);

    const actionClasses = await callTool(access_token, setup, "list_action_classes");
    expect(succeeded(actionClasses), toolText(actionClasses)).toBe(true);
    expect(dataOf(actionClasses)).toEqual([
      expect.objectContaining({ id: setup.actionClassId, name: "Checkout", key: "checkout" }),
    ]);
  });

  test("filters contacts by attribute through the operation", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);

    const match = await callTool(access_token, setup, "list_contacts", {
      filter: { attributes: [{ key: "plan", operator: "eq", values: ["pro"] }] },
    });
    const miss = await callTool(access_token, setup, "list_contacts", {
      filter: { attributes: [{ key: "plan", operator: "eq", values: ["free"] }] },
    });

    expect(dataOf(match)).toHaveLength(1);
    expect(dataOf(miss)).toEqual([]);
  });

  test.each(TOOLS)("$tool is not permitted without $needs", async ({ tool, args, permission }) => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    // Every permission but this one, at the highest level it offers.
    const others: TMcpGrantPermissions = {
      surveys: "write",
      responses: "write",
      contacts: "read",
      contactAttributes: "read",
      segments: "read",
      actionClasses: "read",
    };
    delete others[permission];
    await setGrant(setup, others);

    expectNotPermitted(
      await callTool(access_token, setup, tool, args),
      TOOLS.find((entry) => entry.tool === tool)!.needs
    );
  });

  test("a workspace in another organization is refused like any other v3 read", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);

    for (const { tool, args } of TOOLS) {
      const outcome = await callMcpTool({ accessToken: access_token }, tool, {
        workspaceId: setup.foreignWorkspaceId,
        ...args,
      });
      expect(outcome.result?.isError, `${tool}: ${toolText(outcome)}`).toBe(true);
      expect(problemOf(outcome).status, tool).toBe(403);
      expect(problemOf(outcome).detail, tool).not.toMatch(/^Not permitted/);
    }
  });

  test("without the contacts entitlement, contacts, attributes and segments are refused; action classes are not", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    entitlements.contacts = false;

    for (const tool of [
      "list_contacts",
      "list_contact_attribute_keys",
      "list_contact_attribute_values",
      "list_segments",
    ]) {
      const outcome = await callTool(
        access_token,
        setup,
        tool,
        tool.includes("values") ? { key: "plan" } : {}
      );
      expect(outcome.result?.isError, tool).toBe(true);
      expect(problemOf(outcome), tool).toMatchObject({
        status: 403,
        code: "contacts_not_entitled",
        detail: "The contacts feature is not enabled for this organization.",
      });
    }
    expect(succeeded(await callTool(access_token, setup, "list_action_classes"))).toBe(true);
  });
});

describe("a client connected before audience:read existed", () => {
  test("has Audience at No access, can't raise it without the scope, and gets it after one reconnect", async () => {
    const setup = await setUp();
    // An upgraded instance: the resource and the client were registered before the scope existed.
    await prisma.oauthResource.updateMany({ data: { allowedScopes: PRE_AUDIENCE_SCOPES } });
    await prisma.oauthClient.update({
      where: { clientId: setup.clientId },
      data: { scopes: PRE_AUDIENCE_SCOPES },
    });
    const before = await grant(setup.cookie, setup.clientId, PRE_AUDIENCE_SCOPES.join(" "));

    const stored = await getMcpGrant(setup.userId, setup.clientId);
    expect(stored?.permissions.surveys).toBe("write");
    expect(stored?.permissions.contacts).toBeUndefined();
    // Its token can't carry audience:read either, so the scope half of the gate refuses first.
    const refused = await callTool(before.access_token, setup, "list_contacts");
    expect(refused.result?.isError).toBe(true);
    expect(toolText(refused)).toContain("audience:read");

    // Edit can't give what the token's scopes don't reach: the scope caps the grant.
    await setGrant(setup, { ...stored?.permissions, contacts: "read" });
    const capped = await callTool(before.access_token, setup, "list_contacts");
    expect(capped.result?.isError).toBe(true);
    expect(toolText(capped)).toContain("audience:read");

    // The release's migrations, then the client reconnects asking for what the metadata advertises.
    await grantAudienceScope.run!({ prisma: prisma as never, tx: prisma as never });
    await grantAudienceScopeToClients.run!({ prisma: prisma as never, tx: prisma as never });
    const after = await grant(setup.cookie, setup.clientId, EVERYTHING);

    expect(after.scope.split(" ")).toContain("audience:read");
    expect((await getMcpGrant(setup.userId, setup.clientId))?.permissions.contacts).toBe("read");
    const contacts = await callTool(after.access_token, setup, "list_contacts");
    expect(succeeded(contacts), toolText(contacts)).toBe(true);
  }, 120_000);
});
